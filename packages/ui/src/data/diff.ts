import { diffSequences } from "./myers.ts";

/**
 * Line-level diff of two whole file texts. The host sends `{original, modified}` (from
 * `@rail/git` `gitDiffFile`), so the browser computes hunks itself. Sides follow the review
 * library: `base` is the original text, `worktree` the modified one.
 */

export type LineEnding = "" | "\n" | "\r\n";

export interface SourceLine {
	/** Line content without its line ending. */
	readonly text: string;
	/** The ending that terminated the line; "" only for a final line without a newline. */
	readonly eol: LineEnding;
}

export type DiffLineKind = "context" | "added" | "deleted";

export interface DiffLine {
	readonly kind: DiffLineKind;
	readonly text: string;
	readonly eol: LineEnding;
	/** 1-based line in the base text; null for added lines. */
	readonly baseLine: number | null;
	/** 1-based line in the worktree text; null for deleted lines. */
	readonly worktreeLine: number | null;
}

export interface DiffHunk {
	/** Unified header, `@@ -baseStart,baseCount +worktreeStart,worktreeCount @@`. */
	readonly header: string;
	/** Header start numbers follow the unified format: when a count is 0 the start is the line
	 * before the (empty) range, so an added file reads `@@ -0,0 +1,n @@`. */
	readonly baseStart: number;
	readonly baseCount: number;
	readonly worktreeStart: number;
	readonly worktreeCount: number;
	readonly lines: readonly DiffLine[];
}

export interface LineDiff {
	readonly hunks: readonly DiffHunk[];
	readonly added: number;
	readonly removed: number;
	/** True when the edit distance exceeded `maxEditDistance`: the differing region is shown as
	 * one replace-everything hunk instead of a minimal diff. */
	readonly truncated: boolean;
	readonly baseLineCount: number;
	readonly worktreeLineCount: number;
}

export interface LineDiffOptions {
	/** Unchanged lines around each change (default 3, git's `-U3`). */
	readonly context?: number;
	/** Edit budget (deleted plus inserted lines) for the minimal diff. */
	readonly maxEditDistance?: number;
}

export const DEFAULT_DIFF_CONTEXT = 3;
/** Large enough for heavy edits of ordinary files, small enough that a refusal stays fast. */
export const DEFAULT_MAX_EDIT_DISTANCE = 4000;

/** Split a text into lines, keeping each line's ending. "" has no lines; "a\n" has one. */
export function splitLines(text: string): SourceLine[] {
	const lines: SourceLine[] = [];
	let start = 0;
	while (start < text.length) {
		const newline = text.indexOf("\n", start);
		if (newline === -1) {
			lines.push({ text: text.slice(start), eol: "" });
			break;
		}
		const crlf = newline > start && text.charCodeAt(newline - 1) === 13;
		lines.push({
			text: text.slice(start, crlf ? newline - 1 : newline),
			eol: crlf ? "\r\n" : "\n",
		});
		start = newline + 1;
	}
	return lines;
}

interface Op {
	readonly kind: DiffLineKind;
	/** Base lines consumed before this op (the base index for context and deleted ops). */
	readonly a: number;
	/** Worktree lines consumed before this op. */
	readonly b: number;
}

export function computeLineDiff(
	original: string,
	modified: string,
	options: LineDiffOptions = {},
): LineDiff {
	const context = Math.max(0, Math.floor(options.context ?? DEFAULT_DIFF_CONTEXT));
	const budget = options.maxEditDistance ?? DEFAULT_MAX_EDIT_DISTANCE;
	const baseLines = splitLines(original);
	const worktreeLines = splitLines(modified);
	const [aIds, bIds] = intern(baseLines, worktreeLines);

	const result = diffSequences(aIds, bIds, budget);
	const ops =
		result === null
			? replaceEverything(aIds, bIds)
			: walk(result.aChanged, result.bChanged, aIds.length, bIds.length);
	let added = 0;
	let removed = 0;
	for (const op of ops) {
		if (op.kind === "added") added++;
		else if (op.kind === "deleted") removed++;
	}
	return {
		hunks: buildHunks(ops, context, baseLines, worktreeLines),
		added,
		removed,
		truncated: result === null,
		baseLineCount: baseLines.length,
		worktreeLineCount: worktreeLines.length,
	};
}

/** The line ending is part of a line's identity, so CRLF/LF changes and a missing final newline
 * show as edits, as in git. */
function intern(
	base: readonly SourceLine[],
	worktree: readonly SourceLine[],
): [Int32Array, Int32Array] {
	const ids = new Map<string, number>();
	const toIds = (lines: readonly SourceLine[]) => {
		const out = new Int32Array(lines.length);
		lines.forEach((line, index) => {
			const key = line.text + line.eol;
			let id = ids.get(key);
			if (id === undefined) {
				id = ids.size;
				ids.set(key, id);
			}
			out[index] = id;
		});
		return out;
	};
	return [toIds(base), toIds(worktree)];
}

/** Deletions before insertions within each change, then the shared line. */
function walk(aChanged: Uint8Array, bChanged: Uint8Array, n: number, m: number): Op[] {
	const ops: Op[] = [];
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		while (i < n && aChanged[i] === 1) ops.push({ kind: "deleted", a: i++, b: j });
		while (j < m && bChanged[j] === 1) ops.push({ kind: "added", a: i, b: j++ });
		if (i < n && j < m) ops.push({ kind: "context", a: i++, b: j++ });
		else if (i < n || j < m) break; // unreachable with consistent marks; never spin
	}
	return ops;
}

/** Fallback past the edit budget: keep the common prefix and suffix, replace the middle. */
function replaceEverything(a: Int32Array, b: Int32Array): Op[] {
	let prefix = 0;
	while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < a.length - prefix &&
		suffix < b.length - prefix &&
		a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
	) {
		suffix++;
	}
	const ops: Op[] = [];
	for (let k = 0; k < prefix; k++) ops.push({ kind: "context", a: k, b: k });
	for (let i = prefix; i < a.length - suffix; i++) ops.push({ kind: "deleted", a: i, b: prefix });
	const aEnd = a.length - suffix;
	for (let j = prefix; j < b.length - suffix; j++) ops.push({ kind: "added", a: aEnd, b: j });
	const bEnd = b.length - suffix;
	for (let k = 0; k < suffix; k++) ops.push({ kind: "context", a: aEnd + k, b: bEnd + k });
	return ops;
}

function buildHunks(
	ops: readonly Op[],
	context: number,
	baseLines: readonly SourceLine[],
	worktreeLines: readonly SourceLine[],
): DiffHunk[] {
	const hunks: DiffHunk[] = [];
	let index = 0;
	while (index < ops.length) {
		if (ops[index]?.kind === "context") {
			index++;
			continue;
		}
		const start = Math.max(0, index - context);
		let lastChange = index;
		let cursor = index;
		while (cursor < ops.length) {
			if (ops[cursor]?.kind !== "context") {
				lastChange = cursor++;
				continue;
			}
			let runEnd = cursor;
			while (runEnd < ops.length && ops[runEnd]?.kind === "context") runEnd++;
			// Changes separated by at most 2 * context unchanged lines share a hunk.
			if (runEnd === ops.length || runEnd - cursor > 2 * context) break;
			cursor = runEnd;
		}
		const end = Math.min(ops.length, lastChange + 1 + context);
		hunks.push(toHunk(ops.slice(start, end), baseLines, worktreeLines));
		index = end;
	}
	return hunks;
}

function toHunk(
	ops: readonly Op[],
	baseLines: readonly SourceLine[],
	worktreeLines: readonly SourceLine[],
): DiffHunk {
	const first = ops[0] as Op;
	const lines: DiffLine[] = [];
	let baseCount = 0;
	let worktreeCount = 0;
	for (const op of ops) {
		if (op.kind === "added") {
			const source = worktreeLines[op.b] as SourceLine;
			lines.push({ kind: "added", ...source, baseLine: null, worktreeLine: op.b + 1 });
			worktreeCount++;
		} else if (op.kind === "deleted") {
			const source = baseLines[op.a] as SourceLine;
			lines.push({ kind: "deleted", ...source, baseLine: op.a + 1, worktreeLine: null });
			baseCount++;
		} else {
			// Context lines are equal on both sides, ending included.
			const source = baseLines[op.a] as SourceLine;
			lines.push({ kind: "context", ...source, baseLine: op.a + 1, worktreeLine: op.b + 1 });
			baseCount++;
			worktreeCount++;
		}
	}
	const baseStart = baseCount === 0 ? first.a : first.a + 1;
	const worktreeStart = worktreeCount === 0 ? first.b : first.b + 1;
	return {
		header: formatHunkHeader(baseStart, baseCount, worktreeStart, worktreeCount),
		baseStart,
		baseCount,
		worktreeStart,
		worktreeCount,
		lines,
	};
}

/** Always writes both counts, the form the review library stores as a `diffHunk` selector. */
export function formatHunkHeader(
	baseStart: number,
	baseCount: number,
	worktreeStart: number,
	worktreeCount: number,
): string {
	return `@@ -${baseStart},${baseCount} +${worktreeStart},${worktreeCount} @@`;
}

/** Number of base (or worktree) lines that precede a hunk, from its header numbers. */
export function linesBefore(start: number, count: number): number {
	return count === 0 ? start : start - 1;
}
