import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { useState } from "react";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { List, Tree, type TreeNode } from "./list.tsx";

const { act, cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

interface Row {
	readonly id: string;
	readonly name: string;
	readonly disabled?: boolean;
}

const ROWS: readonly Row[] = [
	{ id: "default", name: "Default" },
	{ id: "login", name: "login" },
	{ id: "detached", name: "detached", disabled: true },
	{ id: "release", name: "release" },
];

function ListHarness({ onSelect }: { readonly onSelect?: (id: string) => void }) {
	const [selected, setSelected] = useState<string | null>("login");
	return (
		<List
			label="Workspaces"
			items={ROWS}
			selectedId={selected}
			onSelect={(id) => {
				onSelect?.(id);
				setSelected(id);
			}}
			renderItem={(item, state) => (
				<span data-focused={state.focused || undefined}>{item.name}</span>
			)}
		/>
	);
}

describe("List", () => {
	test("a listbox whose selected row is the only tabbable row", () => {
		const view = render(<ListHarness />);
		expect(view.getByRole("listbox", { name: "Workspaces" })).toBeDefined();
		const options = view.getAllByRole("option");
		expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual([
			"false",
			"true",
			"false",
			"false",
		]);
		expect(options.map((option) => option.tabIndex)).toEqual([-1, 0, -1, -1]);
		expect(options[2]?.getAttribute("aria-disabled")).toBe("true");
	});

	test("arrows move focus past disabled rows without wrapping; Home and End jump", () => {
		const view = render(<ListHarness />);
		const [first, second, , last] = view.getAllByRole("option") as HTMLElement[];
		act(() => second?.focus());
		fireEvent.keyDown(second as HTMLElement, { key: "ArrowDown" });
		expect(document.activeElement).toBe(last ?? null);
		expect(last?.tabIndex).toBe(0);
		expect(second?.tabIndex).toBe(-1);
		fireEvent.keyDown(last as HTMLElement, { key: "ArrowDown" });
		expect(document.activeElement).toBe(last ?? null);
		fireEvent.keyDown(last as HTMLElement, { key: "Home" });
		expect(document.activeElement).toBe(first ?? null);
		fireEvent.keyDown(first as HTMLElement, { key: "ArrowUp" });
		expect(document.activeElement).toBe(first ?? null);
		fireEvent.keyDown(first as HTMLElement, { key: "End" });
		expect(document.activeElement).toBe(last ?? null);
	});

	test("Enter, Space and click select enabled rows; disabled rows are ignored", () => {
		const seen: string[] = [];
		const view = render(<ListHarness onSelect={(id) => seen.push(id)} />);
		const [first, , disabled, last] = view.getAllByRole("option") as HTMLElement[];
		fireEvent.keyDown(first as HTMLElement, { key: "Enter" });
		fireEvent.keyDown(last as HTMLElement, { key: " " });
		fireEvent.click(disabled as HTMLElement);
		fireEvent.keyDown(disabled as HTMLElement, { key: "Enter" });
		fireEvent.click(first as HTMLElement);
		expect(seen).toEqual(["default", "release", "default"]);
		expect(first?.getAttribute("aria-selected")).toBe("true");
	});

	test("renderItem receives focus state and the empty state replaces the listbox", () => {
		const view = render(<ListHarness />);
		const second = view.getAllByRole("option")[1] as HTMLElement;
		act(() => second.focus());
		expect(second.querySelector("[data-focused]")).not.toBeNull();
		cleanup();
		const empty = render(
			<List label="Empty" items={[]} renderItem={() => null} emptyState={<p>No workspaces</p>} />,
		);
		expect(empty.queryByRole("listbox")).toBeNull();
		expect(empty.getByText("No workspaces")).toBeDefined();
	});
});

const TREE: readonly TreeNode[] = [
	{
		id: "src",
		label: "src",
		children: [
			{ id: "src/a.ts", label: "a.ts" },
			{ id: "src/lib", label: "lib", children: [{ id: "src/lib/b.ts", label: "b.ts" }] },
		],
	},
	{ id: "README.md", label: "README.md", trailing: <span>+3</span> },
	{ id: "locked", label: "locked", disabled: true },
];

function TreeHarness({ onSelect }: { readonly onSelect?: (id: string) => void }) {
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(["src"]));
	const [selected, setSelected] = useState<string | null>(null);
	return (
		<Tree
			label="Files"
			nodes={TREE}
			expandedIds={expanded}
			onExpandedChange={(id, open) => {
				const next = new Set(expanded);
				if (open) next.add(id);
				else next.delete(id);
				setExpanded(next);
			}}
			selectedId={selected}
			onSelect={(id) => {
				onSelect?.(id);
				setSelected(id);
			}}
		/>
	);
}

describe("Tree", () => {
	test("exposes levels, set positions and expansion of visible rows", () => {
		const view = render(<TreeHarness />);
		expect(view.getByRole("tree", { name: "Files" })).toBeDefined();
		const items = view.getAllByRole("treeitem");
		expect(items.map((item) => item.textContent)).toEqual([
			"src",
			"a.ts",
			"lib",
			"README.md+3",
			"locked",
		]);
		expect(items.map((item) => item.getAttribute("aria-level"))).toEqual(["1", "2", "2", "1", "1"]);
		expect(items.map((item) => item.getAttribute("aria-expanded"))).toEqual([
			"true",
			null,
			"false",
			null,
			null,
		]);
		expect(
			items.map(
				(item) => `${item.getAttribute("aria-posinset")}/${item.getAttribute("aria-setsize")}`,
			),
		).toEqual(["1/3", "1/2", "2/2", "2/3", "3/3"]);
		expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1, -1, -1]);
	});

	test("Right expands then enters, Left collapses then climbs, Up and Down move", () => {
		const view = render(<TreeHarness />);
		const row = (name: string | RegExp) => view.getByRole("treeitem", { name }) as HTMLElement;
		act(() => row("src").focus());
		fireEvent.keyDown(row("src"), { key: "ArrowDown" });
		fireEvent.keyDown(row("a.ts"), { key: "ArrowDown" });
		expect(document.activeElement).toBe(row("lib"));
		fireEvent.keyDown(row("lib"), { key: "ArrowRight" });
		expect(row("lib").getAttribute("aria-expanded")).toBe("true");
		fireEvent.keyDown(row("lib"), { key: "ArrowRight" });
		expect(document.activeElement).toBe(row("b.ts"));
		fireEvent.keyDown(row("b.ts"), { key: "ArrowLeft" });
		expect(document.activeElement).toBe(row("lib"));
		fireEvent.keyDown(row("lib"), { key: "ArrowLeft" });
		expect(row("lib").getAttribute("aria-expanded")).toBe("false");
		fireEvent.keyDown(row("lib"), { key: "ArrowLeft" });
		expect(document.activeElement).toBe(row("src"));
		fireEvent.keyDown(row("src"), { key: "End" });
		expect(document.activeElement).toBe(row(/README/));
		fireEvent.keyDown(row(/README/), { key: "Home" });
		expect(document.activeElement).toBe(row("src"));
	});

	test("Enter selects, click on the chevron toggles without selecting, disabled rows do not select", () => {
		const seen: string[] = [];
		const view = render(<TreeHarness onSelect={(id) => seen.push(id)} />);
		const src = view.getByRole("treeitem", { name: "src" });
		fireEvent.keyDown(view.getByRole("treeitem", { name: "a.ts" }), { key: "Enter" });
		fireEvent.click(src.querySelector(".rf-tree-toggle") as HTMLElement);
		expect(src.getAttribute("aria-expanded")).toBe("false");
		expect(view.queryByRole("treeitem", { name: "a.ts" })).toBeNull();
		fireEvent.click(view.getByRole("treeitem", { name: "locked" }));
		fireEvent.click(view.getByRole("treeitem", { name: /README/ }));
		expect(seen).toEqual(["src/a.ts", "README.md"]);
		expect(view.getByRole("treeitem", { name: /README/ }).getAttribute("aria-selected")).toBe(
			"true",
		);
	});
});
