import { describe, expect, test } from "bun:test";
import {
	computeLineDiff,
	type DiffHunk,
	formatHunkHeader,
	type LineDiff,
	linesBefore,
	splitLines,
} from "./diff.ts";
import { diffSequences } from "./myers.ts";

/** Deterministic PRNG (mulberry32) so failures reproduce. */
function rng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Apply the hunks to `original`, checking every context and deleted line against it. */
function applyHunks(original: string, diff: LineDiff): string {
	const base = splitLines(original);
	let out = "";
	let next = 0; // index of the next base line not yet consumed
	for (const hunk of diff.hunks) {
		const before = linesBefore(hunk.baseStart, hunk.baseCount);
		expect(before).toBeGreaterThanOrEqual(next);
		for (; next < before; next++) out += base[next]?.text + (base[next]?.eol ?? "");
		for (const line of hunk.lines) {
			if (line.kind === "added") {
				out += line.text + line.eol;
				continue;
			}
			const source = base[next];
			expect(source).toBeDefined();
			expect(line.text).toBe(source?.text ?? "");
			expect(line.eol).toBe(source?.eol ?? "");
			expect(line.baseLine).toBe(next + 1);
			next++;
			if (line.kind === "context") out += line.text + line.eol;
		}
	}
	for (; next < base.length; next++) out += base[next]?.text + (base[next]?.eol ?? "");
	return out;
}

function checkHeaders(diff: LineDiff): void {
	for (const hunk of diff.hunks) checkHeader(hunk);
}

function checkHeader(hunk: DiffHunk): void {
	const baseCount = hunk.lines.filter((line) => line.kind !== "added").length;
	const worktreeCount = hunk.lines.filter((line) => line.kind !== "deleted").length;
	expect(hunk.baseCount).toBe(baseCount);
	expect(hunk.worktreeCount).toBe(worktreeCount);
	expect(hunk.header).toBe(
		formatHunkHeader(hunk.baseStart, baseCount, hunk.worktreeStart, worktreeCount),
	);
	expect(hunk.header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
	const firstBase = hunk.lines.find((line) => line.baseLine !== null)?.baseLine;
	const firstWorktree = hunk.lines.find((line) => line.worktreeLine !== null)?.worktreeLine;
	if (firstBase !== undefined && firstBase !== null) expect(hunk.baseStart).toBe(firstBase);
	if (firstWorktree !== undefined && firstWorktree !== null) {
		expect(hunk.worktreeStart).toBe(firstWorktree);
	}
}

function lcsDistance(a: readonly number[], b: readonly number[]): number {
	const row = new Array<number>(b.length + 1).fill(0);
	for (let i = 1; i <= a.length; i++) {
		let diagonal = 0;
		for (let j = 1; j <= b.length; j++) {
			const above = row[j] as number;
			row[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1] as number);
			diagonal = above;
		}
	}
	return a.length + b.length - 2 * (row[b.length] as number);
}

const lines = (count: number, prefix = "line") =>
	Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}\n`).join("");

describe("splitLines", () => {
	test("keeps endings and the missing final newline", () => {
		expect(splitLines("")).toEqual([]);
		expect(splitLines("\n")).toEqual([{ text: "", eol: "\n" }]);
		expect(splitLines("a\r\nb\nc")).toEqual([
			{ text: "a", eol: "\r\n" },
			{ text: "b", eol: "\n" },
			{ text: "c", eol: "" },
		]);
		expect(splitLines("a\rb\n")).toEqual([{ text: "a\rb", eol: "\n" }]);
	});
});

describe("diffSequences (Myers core)", () => {
	test("identical and empty sequences", () => {
		expect(diffSequences([], [])?.distance).toBe(0);
		expect(diffSequences([1, 2, 3], [1, 2, 3])?.distance).toBe(0);
		const inserted = diffSequences([], [1, 2]);
		expect(Array.from(inserted?.bChanged ?? [])).toEqual([1, 1]);
		const deleted = diffSequences([1, 2], []);
		expect(Array.from(deleted?.aChanged ?? [])).toEqual([1, 1]);
	});

	test("the paper's example has distance 5", () => {
		const encode = (text: string) => Array.from(text, (char) => char.charCodeAt(0));
		expect(diffSequences(encode("ABCABBA"), encode("CBABAC"))?.distance).toBe(5);
	});

	test("finds a minimal script on random inputs", () => {
		const random = rng(7);
		for (let round = 0; round < 400; round++) {
			const n = Math.floor(random() * 30);
			const m = Math.floor(random() * 30);
			const alphabet = 1 + Math.floor(random() * 5);
			const a = Array.from({ length: n }, () => Math.floor(random() * alphabet));
			const b = Array.from({ length: m }, () => Math.floor(random() * alphabet));
			const result = diffSequences(a, b);
			expect(result).not.toBeNull();
			expect(result?.distance).toBe(lcsDistance(a, b));
			// Unchanged elements of both sides form the same subsequence.
			const keptA = a.filter((_, index) => result?.aChanged[index] === 0);
			const keptB = b.filter((_, index) => result?.bChanged[index] === 0);
			expect(keptA).toEqual(keptB);
		}
	});

	test("refuses past the budget, including pure insertions", () => {
		expect(diffSequences([1, 2, 3, 4], [5, 6, 7, 8], 7)).toBeNull();
		expect(diffSequences([1, 2, 3, 4], [5, 6, 7, 8], 8)?.distance).toBe(8);
		expect(diffSequences([], [1, 2, 3], 2)).toBeNull();
		expect(diffSequences([], [1, 2, 3], 3)?.distance).toBe(3);
	});
});

describe("computeLineDiff", () => {
	test("identical texts have no hunks", () => {
		const diff = computeLineDiff("a\nb\n", "a\nb\n");
		expect(diff.hunks).toEqual([]);
		expect(diff.added).toBe(0);
		expect(diff.removed).toBe(0);
		expect(diff.truncated).toBe(false);
		expect(computeLineDiff("", "").hunks).toEqual([]);
	});

	test("added file", () => {
		const diff = computeLineDiff("", "a\nb\n");
		expect(diff.hunks).toHaveLength(1);
		expect(diff.hunks[0]?.header).toBe("@@ -0,0 +1,2 @@");
		expect(diff.hunks[0]?.lines.map((line) => line.kind)).toEqual(["added", "added"]);
		expect(diff.added).toBe(2);
		checkHeaders(diff);
	});

	test("deleted file", () => {
		const diff = computeLineDiff("a\nb\nc\n", "");
		expect(diff.hunks[0]?.header).toBe("@@ -1,3 +0,0 @@");
		expect(diff.removed).toBe(3);
		expect(diff.hunks[0]?.lines.every((line) => line.worktreeLine === null)).toBe(true);
	});

	test("single change with default context of 3", () => {
		const original = lines(10);
		const modified = original.replace("line 5\n", "line five\n");
		const diff = computeLineDiff(original, modified);
		expect(diff.hunks).toHaveLength(1);
		const hunk = diff.hunks[0] as DiffHunk;
		expect(hunk.header).toBe("@@ -2,7 +2,7 @@");
		expect(hunk.lines.map((line) => line.kind)).toEqual([
			"context",
			"context",
			"context",
			"deleted",
			"added",
			"context",
			"context",
			"context",
		]);
		expect(hunk.lines[3]).toEqual({
			kind: "deleted",
			text: "line 5",
			eol: "\n",
			baseLine: 5,
			worktreeLine: null,
		});
		expect(hunk.lines[4]?.worktreeLine).toBe(5);
	});

	test("context option, merging and splitting hunks", () => {
		const original = lines(30);
		const modified = original.replace("line 5\n", "x\n").replace("line 12\n", "y\n");
		// Gap of 6 unchanged lines (6..11) merges at context 3 (6 <= 2 * 3).
		expect(computeLineDiff(original, modified).hunks).toHaveLength(1);
		// At context 2 the gap exceeds 4 and the hunks split.
		const split = computeLineDiff(original, modified, { context: 2 });
		expect(split.hunks.map((hunk) => hunk.header)).toEqual([
			"@@ -3,5 +3,5 @@",
			"@@ -10,5 +10,5 @@",
		]);
		const zero = computeLineDiff(original, modified, { context: 0 });
		expect(zero.hunks.map((hunk) => hunk.header)).toEqual(["@@ -5,1 +5,1 @@", "@@ -12,1 +12,1 @@"]);
	});

	test("pure insertion and deletion at context 0 use the line-before start", () => {
		const original = "a\nb\nc\n";
		expect(computeLineDiff(original, "a\nb\nX\nc\n", { context: 0 }).hunks[0]?.header).toBe(
			"@@ -2,0 +3,1 @@",
		);
		expect(computeLineDiff(original, "a\nc\n", { context: 0 }).hunks[0]?.header).toBe(
			"@@ -2,1 +1,0 @@",
		);
		expect(computeLineDiff(original, "X\na\nb\nc\n", { context: 0 }).hunks[0]?.header).toBe(
			"@@ -0,0 +1,1 @@",
		);
	});

	test("missing final newline counts as a change of the last line", () => {
		const diff = computeLineDiff("a\nb\n", "a\nb");
		expect(diff.added).toBe(1);
		expect(diff.removed).toBe(1);
		const lastTwo = diff.hunks[0]?.lines.slice(-2);
		expect(lastTwo).toEqual([
			{ kind: "deleted", text: "b", eol: "\n", baseLine: 2, worktreeLine: null },
			{ kind: "added", text: "b", eol: "", baseLine: null, worktreeLine: 2 },
		]);
		expect(applyHunks("a\nb\n", diff)).toBe("a\nb");
		expect(applyHunks("a\nb", computeLineDiff("a\nb", "a\nb\nc"))).toBe("a\nb\nc");
	});

	test("CRLF: text excludes the ending, ending changes are edits", () => {
		const crlf = "a\r\nb\r\nc\r\n";
		const edited = computeLineDiff(crlf, "a\r\nB\r\nc\r\n");
		expect(edited.added).toBe(1);
		expect(edited.hunks[0]?.lines[1]).toEqual({
			kind: "deleted",
			text: "b",
			eol: "\r\n",
			baseLine: 2,
			worktreeLine: null,
		});
		const converted = computeLineDiff(crlf, "a\nb\nc\n");
		expect(converted.added).toBe(3);
		expect(converted.removed).toBe(3);
		expect(applyHunks(crlf, converted)).toBe("a\nb\nc\n");
	});

	test("past maxEditDistance: one replace-everything hunk flagged truncated", () => {
		const original = lines(50);
		const modified = `${lines(1, "head")}${lines(50, "other")}${lines(1, "tail")}`;
		const diff = computeLineDiff(original, modified, { maxEditDistance: 10 });
		expect(diff.truncated).toBe(true);
		expect(diff.hunks).toHaveLength(1);
		expect(diff.hunks[0]?.header).toBe("@@ -1,50 +1,52 @@");
		expect(diff.removed).toBe(50);
		expect(diff.added).toBe(52);
		expect(applyHunks(original, diff)).toBe(modified);
	});

	test("truncation keeps the common prefix and suffix as context", () => {
		const original = `${lines(10, "keep")}${lines(20, "old")}${lines(10, "end")}`;
		const modified = `${lines(10, "keep")}${lines(20, "new")}${lines(10, "end")}`;
		const diff = computeLineDiff(original, modified, { maxEditDistance: 5 });
		expect(diff.truncated).toBe(true);
		expect(diff.hunks.map((hunk) => hunk.header)).toEqual(["@@ -8,26 +8,26 @@"]);
		expect(applyHunks(original, diff)).toBe(modified);
		expect(computeLineDiff(original, modified).truncated).toBe(false);
	});

	test("a large file with scattered edits stays minimal", () => {
		const original = lines(5000);
		const baseLines = splitLines(original).map((line) => line.text);
		const random = rng(11);
		const edited = [...baseLines];
		for (let edit = 0; edit < 200; edit++) {
			const at = Math.floor(random() * edited.length);
			edited[at] = `edited ${edit}`;
		}
		const modified = `${edited.join("\n")}\n`;
		const diff = computeLineDiff(original, modified);
		expect(diff.truncated).toBe(false);
		expect(diff.added).toBe(diff.removed);
		expect(diff.added).toBeLessThanOrEqual(200);
		expect(applyHunks(original, diff)).toBe(modified);
		checkHeaders(diff);
	});

	test("property: applying the hunks reproduces the modified text", () => {
		const random = rng(42);
		const vocabulary = ["", "a", "b", "c", "foo()", "  return x;", "}", "// note"];
		const pick = () => vocabulary[Math.floor(random() * vocabulary.length)] as string;
		const ending = () => (random() < 0.15 ? "\r\n" : "\n");
		const makeText = (lineList: readonly string[]) => {
			const parts = lineList.map((line) => line + ending());
			const text = parts.join("");
			return random() < 0.3 && text.endsWith("\n") ? text.replace(/\r?\n$/, "") : text;
		};
		for (let round = 0; round < 300; round++) {
			const baseList = Array.from({ length: Math.floor(random() * 40) }, pick);
			const worktreeList = [...baseList];
			const edits = Math.floor(random() * 8);
			for (let edit = 0; edit < edits; edit++) {
				const at = Math.floor(random() * (worktreeList.length + 1));
				const roll = random();
				if (roll < 0.33) worktreeList.splice(at, 0, pick());
				else if (roll < 0.66) worktreeList.splice(at, 1);
				else worktreeList[at] = pick();
			}
			const original = makeText(baseList);
			const modified = makeText(worktreeList);
			const context = Math.floor(random() * 5);
			const budget = random() < 0.2 ? Math.floor(random() * 4) : undefined;
			const diff = computeLineDiff(
				original,
				modified,
				budget === undefined ? { context } : { context, maxEditDistance: budget },
			);
			expect(applyHunks(original, diff)).toBe(modified);
			checkHeaders(diff);
			expect(diff.hunks.length === 0).toBe(original === modified);
			const counted = diff.hunks.flatMap((hunk) => hunk.lines);
			expect(counted.filter((line) => line.kind === "added")).toHaveLength(diff.added);
			expect(counted.filter((line) => line.kind === "deleted")).toHaveLength(diff.removed);
		}
	});
});
