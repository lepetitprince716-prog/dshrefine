import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import type { DiffViewProps, DiffViewVirtualizerOverrides } from "./DiffView.tsx";
import type { DiffLineKey, DiffLineRange, DiffLineRef } from "./diffRows.ts";

const { cleanup, fireEvent, render } = await loadTestingLibrary();
// react-virtual loads react-dom, so the component is imported after happy-dom is registered.
const { DiffView } = await import("./DiffView.tsx");
releaseDomAfterAll(afterAll);
afterEach(cleanup);

// react-virtual measures 0 under happy-dom; report a fixed viewport so rows render.
const sized: DiffViewVirtualizerOverrides = {
	observeElementRect: (_instance, cb) => {
		cb({ width: 800, height: 4000 });
		return () => {};
	},
	observeElementOffset: (_instance, cb) => {
		cb(0, false);
		return () => {};
	},
};

const labels = {
	grid: "Diff of a.ts",
	addComment: "Add comment",
	expand: (count: number) => `Show ${count} lines`,
	truncated: "Diff too large",
	noNewline: "No newline at end of file",
	empty: "No changes",
};

const lines = (count: number) =>
	Array.from({ length: count }, (_, index) => `line ${index + 1}\n`).join("");
const original = lines(20);
const modified = original.replace("line 10\n", "line ten\n");

function renderDiff(props: Partial<DiffViewProps> = {}) {
	return render(
		<DiffView
			original={original}
			modified={modified}
			labels={labels}
			virtualizer={sized}
			{...props}
		/>,
	);
}

function rowsOf(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>('[role="row"]'));
}

function addButton(container: HTMLElement, side: string, line: number): HTMLElement {
	const button = container.querySelector<HTMLElement>(
		`button.rf-diff-add[data-side="${side}"][data-line="${line}"]`,
	);
	if (button === null) throw new Error(`no add button for ${side}:${line}`);
	return button;
}

function rowWithText(container: HTMLElement, text: string): HTMLElement {
	const row = rowsOf(container).find((candidate) =>
		Array.from(candidate.querySelectorAll(".rf-diff-text")).some(
			(cell) => cell.textContent === text,
		),
	);
	if (row === undefined) throw new Error(`no row with ${text}`);
	return row;
}

describe("DiffView unified", () => {
	test("renders gap, context, deleted and added rows with gutters", () => {
		const view = renderDiff();
		const grid = view.getByRole("grid", { name: "Diff of a.ts" });
		expect(grid.getAttribute("tabindex")).toBe("0");
		const rows = rowsOf(view.container);
		expect(rows).toHaveLength(10);
		expect(rows[0]?.textContent).toContain("Show 6 lines");
		expect(rows[0]?.textContent).toContain("@@ -7,7 +7,7 @@");
		const deleted = rowWithText(view.container, "line 10");
		expect(deleted.className).toContain("rf-diff-line--deleted");
		const numbers = Array.from(deleted.querySelectorAll(".rf-diff-num")).map((n) => n.textContent);
		expect(numbers).toEqual(["10", ""]);
		const added = rowWithText(view.container, "line ten");
		expect(added.className).toContain("rf-diff-line--added");
		expect(added.nextElementSibling?.querySelector(".rf-diff-text")?.textContent).toBe("line 11");
	});

	test("paired lines get a word-level highlight", () => {
		const view = renderDiff();
		const words = Array.from(view.container.querySelectorAll(".rf-diff-word")).map(
			(node) => node.textContent,
		);
		expect(words).toEqual(["10", "ten"]);
	});

	test("expanding a gap shows its lines", () => {
		const view = renderDiff();
		fireEvent.click(view.getByRole("button", { name: /Show 6 lines/ }));
		expect(rowsOf(view.container)).toHaveLength(15);
		expect(rowWithText(view.container, "line 1")).toBeDefined();
	});

	test("no-newline marker, truncation notice and empty state", () => {
		const eof = renderDiff({ original: "a\nb\n", modified: "a\nb" });
		expect(eof.getByText("No newline at end of file")).toBeDefined();
		cleanup();
		const truncated = renderDiff({ diffOptions: { maxEditDistance: 1 } });
		expect(truncated.getByRole("note").textContent).toContain("Diff too large");
		cleanup();
		const empty = renderDiff({ original: "", modified: "" });
		expect(empty.getByText("No changes")).toBeDefined();
	});
});

describe("DiffView split", () => {
	test("puts the deleted and the added line on one row", () => {
		const view = renderDiff({ mode: "split" });
		const row = rowWithText(view.container, "line 10");
		const halves = row.querySelectorAll(".rf-diff-half");
		expect(halves).toHaveLength(2);
		expect(halves[0]?.className).toContain("rf-diff-line--deleted");
		expect(halves[1]?.className).toContain("rf-diff-line--added");
		expect(halves[1]?.querySelector(".rf-diff-text")?.textContent).toBe("line ten");
		expect(view.getByRole("grid").getAttribute("aria-colcount")).toBe("2");
	});

	test("an unpaired added line leaves the base half empty", () => {
		const view = renderDiff({
			mode: "split",
			modified: original.replace("line 10\n", "line 10\nnew\n"),
		});
		const row = rowWithText(view.container, "new");
		expect(row.querySelector(".rf-diff-half--empty")).not.toBeNull();
	});
});

describe("DiffView review affordances", () => {
	test("no + buttons without onAddComment", () => {
		const view = renderDiff();
		expect(view.container.querySelector("button.rf-diff-add")).toBeNull();
	});

	test("gutter hover reports the line and null on leave", () => {
		const seen: (DiffLineRef | null)[] = [];
		const view = renderDiff({ onGutterHover: (ref) => seen.push(ref) });
		const gutter = rowWithText(view.container, "line 10").querySelector(".rf-diff-gutter");
		if (gutter === null) throw new Error("no gutter");
		fireEvent.mouseEnter(gutter);
		fireEvent.mouseLeave(gutter);
		expect(seen).toEqual([{ side: "base", line: 10 }, null]);
	});

	test("+ click adds a single-line comment", () => {
		const ranges: DiffLineRange[] = [];
		const view = renderDiff({ onAddComment: (range) => ranges.push(range) });
		const button = addButton(view.container, "worktree", 10);
		expect(button.getAttribute("aria-label")).toBe("Add comment");
		fireEvent.mouseDown(button, { button: 0 });
		fireEvent.mouseUp(button);
		expect(ranges).toEqual([{ side: "worktree", startLine: 10, endLine: 10 }]);
	});

	test("dragging from + selects a multi-line range on one side", () => {
		const ranges: DiffLineRange[] = [];
		const view = renderDiff({ onAddComment: (range) => ranges.push(range) });
		fireEvent.mouseDown(addButton(view.container, "worktree", 12), { button: 0 });
		fireEvent.mouseEnter(rowWithText(view.container, "line 11"));
		fireEvent.mouseEnter(rowWithText(view.container, "line 10")); // base-only row: ignored
		fireEvent.mouseEnter(rowWithText(view.container, "line ten"));
		const selected = view.container.querySelectorAll(".rf-diff-row--selected");
		expect(selected).toHaveLength(3);
		fireEvent.mouseUp(rowWithText(view.container, "line ten"));
		expect(ranges).toEqual([{ side: "worktree", startLine: 10, endLine: 12 }]);
		expect(view.container.querySelectorAll(".rf-diff-row--selected")).toHaveLength(0);
	});

	test("shift-click extends from the previous anchor on the same side", () => {
		const ranges: DiffLineRange[] = [];
		const view = renderDiff({ onAddComment: (range) => ranges.push(range) });
		fireEvent.mouseDown(addButton(view.container, "worktree", 8), { button: 0 });
		fireEvent.mouseUp(window);
		fireEvent.mouseDown(addButton(view.container, "worktree", 12), { button: 0, shiftKey: true });
		fireEvent.mouseUp(window);
		// A shift-click on the other side has no anchor there and stays single-line.
		fireEvent.mouseDown(addButton(view.container, "base", 10), { button: 0, shiftKey: true });
		fireEvent.mouseUp(window);
		expect(ranges).toEqual([
			{ side: "worktree", startLine: 8, endLine: 8 },
			{ side: "worktree", startLine: 8, endLine: 12 },
			{ side: "base", startLine: 10, endLine: 10 },
		]);
	});

	test("keyboard activation of + adds a comment", () => {
		const ranges: DiffLineRange[] = [];
		const view = renderDiff({ onAddComment: (range) => ranges.push(range) });
		fireEvent.click(addButton(view.container, "base", 10));
		expect(ranges).toEqual([{ side: "base", startLine: 10, endLine: 10 }]);
	});

	test("split mode: + on each half uses that half's side", () => {
		const ranges: DiffLineRange[] = [];
		const view = renderDiff({ mode: "split", onAddComment: (range) => ranges.push(range) });
		fireEvent.click(addButton(view.container, "base", 10));
		fireEvent.click(addButton(view.container, "worktree", 10));
		expect(ranges.map((range) => range.side)).toEqual(["base", "worktree"]);
	});

	test("a thread row is inserted below its anchored line", () => {
		const threads = new Set<DiffLineKey>(["worktree:10"]);
		const view = renderDiff({
			threadsByLine: threads,
			renderThread: (key) => <div data-testid="thread">{`thread ${key}`}</div>,
		});
		const thread = view.getByTestId("thread");
		expect(thread.textContent).toBe("thread worktree:10");
		const threadRow = thread.closest('[role="row"]');
		const previous = threadRow?.previousElementSibling;
		expect(previous?.querySelector(".rf-diff-text")?.textContent).toBe("line ten");
		expect(threadRow?.className).toContain("rf-diff-thread");
	});

	test("a thread inside a collapsed gap expands it", () => {
		const view = renderDiff({
			threadsByLine: new Set<DiffLineKey>(["worktree:2"]),
			renderThread: () => <span data-testid="thread" />,
		});
		const row = view.getByTestId("thread").closest('[role="row"]');
		expect(row?.previousElementSibling?.querySelector(".rf-diff-text")?.textContent).toBe("line 2");
	});

	test("threads are ignored without renderThread", () => {
		const view = renderDiff({ threadsByLine: new Set<DiffLineKey>(["worktree:10"]) });
		expect(view.container.querySelector(".rf-diff-thread")).toBeNull();
	});
});

describe("DiffView keyboard", () => {
	test("arrow keys move a line cursor tracked by aria-activedescendant", () => {
		const view = renderDiff();
		const grid = view.getByRole("grid");
		grid.focus();
		expect(grid.getAttribute("aria-activedescendant")).toBeNull();
		const active = () => {
			const id = grid.getAttribute("aria-activedescendant");
			return id === null ? null : document.getElementById(id);
		};
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		expect(active()?.className).toContain("rf-diff-gap");
		expect(active()?.className).toContain("rf-diff-row--cursor");
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		expect(active()?.querySelector(".rf-diff-text")?.textContent).toBe("line 7");
		fireEvent.keyDown(grid, { key: "End" });
		expect(active()?.className).toContain("rf-diff-gap");
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		expect(active()?.className).toContain("rf-diff-gap"); // stays on the last row
		fireEvent.keyDown(grid, { key: "ArrowUp" });
		expect(active()?.querySelector(".rf-diff-text")?.textContent).toBe("line 13");
		fireEvent.keyDown(grid, { key: "Home" });
		expect(active()?.className).toContain("rf-diff-gap");
	});

	test("Enter adds a comment on the cursor line and expands a gap", () => {
		const ranges: DiffLineRange[] = [];
		const view = renderDiff({ onAddComment: (range) => ranges.push(range) });
		const grid = view.getByRole("grid");
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		fireEvent.keyDown(grid, { key: "Enter" });
		expect(rowsOf(view.container)).toHaveLength(15);
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		fireEvent.keyDown(grid, { key: "Enter" });
		expect(ranges).toEqual([{ side: "worktree", startLine: 2, endLine: 2 }]);
	});
});
