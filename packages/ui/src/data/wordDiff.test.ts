import { describe, expect, test } from "bun:test";
import { computeWordDiff, INLINE_DIFF_MAX_LENGTH, tokenizeWords } from "./wordDiff.ts";

const changed = (segments: readonly { text: string; changed: boolean }[]) =>
	segments.filter((segment) => segment.changed).map((segment) => segment.text);
const joined = (segments: readonly { text: string }[]) => segments.map((s) => s.text).join("");

describe("tokenizeWords", () => {
	test("splits words, whitespace runs and single punctuation", () => {
		expect(tokenizeWords("const x_1 = foo(a, b);")).toEqual([
			"const",
			" ",
			"x_1",
			" ",
			"=",
			" ",
			"foo",
			"(",
			"a",
			",",
			" ",
			"b",
			")",
			";",
		]);
		expect(tokenizeWords("")).toEqual([]);
		expect(tokenizeWords("名前  変更")).toEqual(["名前", "  ", "変更"]);
	});
});

describe("computeWordDiff", () => {
	test("highlights only the changed word on each side", () => {
		const result = computeWordDiff("return value + 1;", "return value + 2;");
		expect(result).not.toBeNull();
		expect(changed(result?.base ?? [])).toEqual(["1"]);
		expect(changed(result?.worktree ?? [])).toEqual(["2"]);
	});

	test("segments reassemble the original lines and merge adjacent runs", () => {
		const base = "let a = compute(x, y);";
		const worktree = "const a = computeAll(x);";
		const result = computeWordDiff(base, worktree);
		expect(joined(result?.base ?? [])).toBe(base);
		expect(joined(result?.worktree ?? [])).toBe(worktree);
		const flags = (result?.worktree ?? []).map((segment) => segment.changed);
		for (let index = 1; index < flags.length; index++) {
			expect(flags[index]).not.toBe(flags[index - 1]);
		}
	});

	test("identical lines have no changed segment", () => {
		const result = computeWordDiff("same text", "same text");
		expect(changed(result?.base ?? [])).toEqual([]);
		expect(result?.worktree).toEqual([{ text: "same text", changed: false }]);
	});

	test("empty sides", () => {
		expect(computeWordDiff("", "new")?.worktree).toEqual([{ text: "new", changed: true }]);
		expect(computeWordDiff("old", "")?.base).toEqual([{ text: "old", changed: true }]);
	});

	test("lines over the limit get no inline highlight", () => {
		const long = "x".repeat(INLINE_DIFF_MAX_LENGTH + 1);
		const limit = "y".repeat(INLINE_DIFF_MAX_LENGTH);
		expect(computeWordDiff(long, "short")).toBeNull();
		expect(computeWordDiff("short", long)).toBeNull();
		expect(computeWordDiff(limit, "short")).not.toBeNull();
		expect(computeWordDiff("abc", "abd", 2)).toBeNull();
	});
});
