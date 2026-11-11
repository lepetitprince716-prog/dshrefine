import { describe, expect, test } from "bun:test";
import { computeLineDiff, splitLines } from "./diff.ts";
import {
	buildDiffRows,
	type DiffLineKey,
	type DiffRow,
	diffGaps,
	lineKey,
	rowLineRefs,
} from "./diffRows.ts";

const lines = (count: number) =>
	Array.from({ length: count }, (_, index) => `line ${index + 1}\n`).join("");

function rowsFor(
	original: string,
	modified: string,
	options: {
		mode?: "unified" | "split";
		expanded?: number[];
		threads?: DiffLineKey[];
	} = {},
): DiffRow[] {
	return buildDiffRows({
		diff: computeLineDiff(original, modified),
		baseLines: splitLines(original),
		mode: options.mode ?? "unified",
		expanded: new Set(options.expanded ?? []),
		threads: new Set(options.threads ?? []),
	});
}

const original = lines(20);
const modified = original.replace("line 10\n", "line ten\n");

describe("diffGaps", () => {
	test("leading and trailing unchanged regions with the worktree shift", () => {
		const diff = computeLineDiff(original, original.replace("line 10\n", "a\nb\n"));
		expect(diffGaps(diff)).toEqual([
			{ from: 0, count: 6, shift: 0 },
			{ from: 13, count: 7, shift: 1 },
		]);
		expect(diffGaps(computeLineDiff("a\n", "a\n"))).toEqual([{ from: 0, count: 1, shift: 0 }]);
	});
});

describe("buildDiffRows", () => {
	test("unified: gap, hunk lines, trailing gap", () => {
		const rows = rowsFor(original, modified);
		expect(rows.map((row) => row.type)).toEqual([
			"gap",
			"line",
			"line",
			"line",
			"line",
			"line",
			"line",
			"line",
			"line",
			"gap",
		]);
		expect(rows[0]).toEqual({ type: "gap", gap: 0, count: 6, header: "@@ -7,7 +7,7 @@" });
		expect(rows[9]).toEqual({ type: "gap", gap: 1, count: 7, header: null });
		const deleted = rows[4];
		expect(deleted).toMatchObject({ type: "line", kind: "deleted", base: 10, worktree: null });
		expect(deleted?.type === "line" ? deleted.partner : null).toBe("line ten");
	});

	test("a hunk at line 1 gets a header row instead of a gap", () => {
		const rows = rowsFor("a\nb\n", "A\nb\n");
		expect(rows[0]).toEqual({ type: "hunk", header: "@@ -1,2 +1,2 @@" });
	});

	test("expanded gaps render context lines with both numbers", () => {
		const rows = rowsFor(original, original.replace("line 10\n", "a\nb\n"), { expanded: [1] });
		const trailing = rows.slice(-7);
		expect(trailing.every((row) => row.type === "line" && row.kind === "context")).toBe(true);
		expect(trailing[0]).toMatchObject({ base: 14, worktree: 15, text: "line 14" });
		expect(rows.some((row) => row.type === "gap" && row.gap === 1)).toBe(false);
	});

	test("thread rows follow their line; a gap holding a thread opens", () => {
		const rows = rowsFor(original, modified, { threads: ["worktree:10", "base:2"] });
		const threadIndex = rows.findIndex((row) => row.type === "thread" && row.key === "worktree:10");
		expect(rows[threadIndex - 1]).toMatchObject({ type: "line", kind: "added", worktree: 10 });
		const baseThread = rows.findIndex((row) => row.type === "thread" && row.key === "base:2");
		expect(rows[baseThread - 1]).toMatchObject({ type: "line", base: 2 });
		expect(rows[0]).toMatchObject({ type: "line", base: 1 });
	});

	test("split: deleted and added lines pair on one row", () => {
		const rows = rowsFor("a\nb\nc\n", "a\nB\nX\nc\n", { mode: "split" });
		const changed = rows.filter((row) => row.type === "split" && row.left?.kind !== "context");
		expect(changed).toEqual([
			{
				type: "split",
				left: { kind: "deleted", text: "b", line: 2, partner: "B", noNewline: false },
				right: { kind: "added", text: "B", line: 2, partner: "b", noNewline: false },
			},
			{
				type: "split",
				left: null,
				right: { kind: "added", text: "X", line: 3, partner: null, noNewline: false },
			},
		]);
	});

	test("split thread rows use either side's key", () => {
		const rows = rowsFor("a\nb\nc\n", "a\nB\nc\n", { mode: "split", threads: ["base:2"] });
		const index = rows.findIndex((row) => row.type === "thread");
		expect(rows[index - 1]).toMatchObject({ type: "split", left: { line: 2 } });
	});

	test("no newline flag and line refs", () => {
		const rows = rowsFor("a\nb\n", "a\nb");
		const added = rows.find((row) => row.type === "line" && row.kind === "added");
		expect(added).toMatchObject({ noNewline: true });
		if (added) expect(rowLineRefs(added)).toEqual([{ side: "worktree", line: 2 }]);
		expect(lineKey({ side: "base", line: 3 })).toBe("base:3");
	});

	test("both sides empty: no rows", () => {
		expect(rowsFor("", "")).toEqual([]);
	});
});
