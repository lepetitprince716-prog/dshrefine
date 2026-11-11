import {
	type DiffHunk,
	type DiffLine,
	type DiffLineKind,
	type LineDiff,
	linesBefore,
	type SourceLine,
} from "./diff.ts";

/** Review-library sides: `base` is the original text, `worktree` the modified one. */
export type DiffSide = "base" | "worktree";

export interface DiffLineRef {
	readonly side: DiffSide;
	/** 1-based line number on that side. */
	readonly line: number;
}

export interface DiffLineRange {
	readonly side: DiffSide;
	readonly startLine: number;
	readonly endLine: number;
}

/** Stable string identity of a line, `"<side>:<line>"`; thread anchors use it. */
export type DiffLineKey = `${DiffSide}:${number}`;

export function lineKey(ref: DiffLineRef): DiffLineKey {
	return `${ref.side}:${ref.line}`;
}

export interface UnifiedLineRow {
	readonly type: "line";
	readonly kind: DiffLineKind;
	readonly text: string;
	readonly base: number | null;
	readonly worktree: number | null;
	/** Text of the paired line on the other side, for the intra-line highlight. */
	readonly partner: string | null;
	readonly noNewline: boolean;
}

export interface SplitCell {
	readonly kind: DiffLineKind;
	readonly text: string;
	readonly line: number;
	readonly partner: string | null;
	readonly noNewline: boolean;
}

export interface SplitLineRow {
	readonly type: "split";
	/** Base side. */
	readonly left: SplitCell | null;
	/** Worktree side. */
	readonly right: SplitCell | null;
}

/** Collapsed unchanged lines; `header` is the following hunk's header (null at the end). */
export interface GapRow {
	readonly type: "gap";
	readonly gap: number;
	readonly count: number;
	readonly header: string | null;
}

export interface HunkHeaderRow {
	readonly type: "hunk";
	readonly header: string;
}

export interface ThreadRow {
	readonly type: "thread";
	readonly key: DiffLineKey;
}

export type DiffRow = UnifiedLineRow | SplitLineRow | GapRow | HunkHeaderRow | ThreadRow;

export type DiffMode = "unified" | "split";

export interface DiffRowsInput {
	readonly diff: LineDiff;
	/** Lines of the base text (`splitLines(original)`), used to fill expanded gaps. */
	readonly baseLines: readonly SourceLine[];
	readonly mode: DiffMode;
	/** Gap indexes the user expanded. */
	readonly expanded: ReadonlySet<number>;
	/** Lines that carry a thread; a gap holding one is expanded so the thread can render. */
	readonly threads: ReadonlySet<DiffLineKey>;
}

interface Gap {
	/** 0-based index of the first base line in the gap. */
	readonly from: number;
	readonly count: number;
	/** worktree line number minus base line number inside the gap. */
	readonly shift: number;
}

/** Unchanged regions before each hunk and after the last one (index `hunks.length`). */
export function diffGaps(diff: LineDiff): Gap[] {
	const gaps: Gap[] = [];
	let baseEnd = 0;
	let worktreeEnd = 0;
	for (const hunk of diff.hunks) {
		const baseBefore = linesBefore(hunk.baseStart, hunk.baseCount);
		const worktreeBefore = linesBefore(hunk.worktreeStart, hunk.worktreeCount);
		gaps.push({ from: baseEnd, count: baseBefore - baseEnd, shift: worktreeBefore - baseBefore });
		baseEnd = baseBefore + hunk.baseCount;
		worktreeEnd = worktreeBefore + hunk.worktreeCount;
	}
	gaps.push({ from: baseEnd, count: diff.baseLineCount - baseEnd, shift: worktreeEnd - baseEnd });
	return gaps;
}

function gapHasThread(gap: Gap, threads: ReadonlySet<DiffLineKey>): boolean {
	for (const key of threads) {
		const [side, raw] = key.split(":") as [DiffSide, string];
		const line = Number(raw) - (side === "worktree" ? gap.shift : 0);
		if (line > gap.from && line <= gap.from + gap.count) return true;
	}
	return false;
}

export function buildDiffRows(input: DiffRowsInput): DiffRow[] {
	const { diff, baseLines, mode, expanded, threads } = input;
	const rows: DiffRow[] = [];
	const pushThreads = (keys: readonly (DiffLineKey | null)[]) => {
		for (const key of keys)
			if (key !== null && threads.has(key)) rows.push({ type: "thread", key });
	};
	const pushLine = (line: UnifiedLineRow) => {
		if (mode === "unified") {
			rows.push(line);
			pushThreads(lineKeys(line.base, line.worktree));
			return;
		}
		const left = line.base === null ? null : toCell(line, line.base);
		const right = line.worktree === null ? null : toCell(line, line.worktree);
		rows.push({ type: "split", left, right });
		pushThreads(lineKeys(line.base, line.worktree));
	};

	diffGaps(diff).forEach((gap, index) => {
		const next: DiffHunk | undefined = diff.hunks[index];
		const open = gap.count > 0 && (expanded.has(index) || gapHasThread(gap, threads));
		if (open) {
			for (let offset = 0; offset < gap.count; offset++) {
				const source = baseLines[gap.from + offset];
				if (source === undefined) break;
				const base = gap.from + offset + 1;
				pushLine(contextRow(source, base, base + gap.shift));
			}
		} else if (gap.count > 0) {
			rows.push({ type: "gap", gap: index, count: gap.count, header: next?.header ?? null });
		} else if (next !== undefined) {
			rows.push({ type: "hunk", header: next.header });
		}
		if (next === undefined) return;
		if (mode === "unified") {
			for (const line of pairLines(next.lines)) pushLine(line);
		} else {
			pushSplitHunk(next.lines, rows, pushThreads);
		}
	});
	return rows;
}

function lineKeys(base: number | null, worktree: number | null): (DiffLineKey | null)[] {
	return [
		base === null ? null : lineKey({ side: "base", line: base }),
		worktree === null ? null : lineKey({ side: "worktree", line: worktree }),
	];
}

function contextRow(source: SourceLine, base: number, worktree: number): UnifiedLineRow {
	return {
		type: "line",
		kind: "context",
		text: source.text,
		base,
		worktree,
		partner: null,
		noNewline: source.eol === "",
	};
}

function toCell(line: UnifiedLineRow, number: number): SplitCell {
	return {
		kind: line.kind,
		text: line.text,
		line: number,
		partner: line.partner,
		noNewline: line.noNewline,
	};
}

/** Change blocks are runs of deleted lines followed by added lines; pair them by position. */
function changeBlocks(lines: readonly DiffLine[]): { deleted: DiffLine[]; added: DiffLine[] }[] {
	const blocks: { deleted: DiffLine[]; added: DiffLine[] }[] = [];
	let current: { deleted: DiffLine[]; added: DiffLine[] } | null = null;
	for (const line of lines) {
		if (line.kind === "context") {
			current = null;
			continue;
		}
		if (current === null || (line.kind === "deleted" && current.added.length > 0)) {
			current = { deleted: [], added: [] };
			blocks.push(current);
		}
		(line.kind === "deleted" ? current.deleted : current.added).push(line);
	}
	return blocks;
}

function partners(lines: readonly DiffLine[]): Map<DiffLine, string> {
	const map = new Map<DiffLine, string>();
	for (const block of changeBlocks(lines)) {
		const pairs = Math.min(block.deleted.length, block.added.length);
		for (let index = 0; index < pairs; index++) {
			const deleted = block.deleted[index] as DiffLine;
			const added = block.added[index] as DiffLine;
			map.set(deleted, added.text);
			map.set(added, deleted.text);
		}
	}
	return map;
}

function pairLines(lines: readonly DiffLine[]): UnifiedLineRow[] {
	const partnerOf = partners(lines);
	return lines.map((line) => ({
		type: "line",
		kind: line.kind,
		text: line.text,
		base: line.baseLine,
		worktree: line.worktreeLine,
		partner: partnerOf.get(line) ?? null,
		noNewline: line.eol === "",
	}));
}

function pushSplitHunk(
	lines: readonly DiffLine[],
	rows: DiffRow[],
	pushThreads: (keys: readonly (DiffLineKey | null)[]) => void,
): void {
	const unified = pairLines(lines);
	let index = 0;
	while (index < unified.length) {
		const row = unified[index] as UnifiedLineRow;
		if (row.kind === "context") {
			rows.push({
				type: "split",
				left: toCell(row, row.base as number),
				right: toCell(row, row.worktree as number),
			});
			pushThreads(lineKeys(row.base, row.worktree));
			index++;
			continue;
		}
		const deleted: UnifiedLineRow[] = [];
		const added: UnifiedLineRow[] = [];
		while (unified[index]?.kind === "deleted") deleted.push(unified[index++] as UnifiedLineRow);
		while (unified[index]?.kind === "added") added.push(unified[index++] as UnifiedLineRow);
		const height = Math.max(deleted.length, added.length);
		for (let offset = 0; offset < height; offset++) {
			const left = deleted[offset];
			const right = added[offset];
			rows.push({
				type: "split",
				left: left === undefined ? null : toCell(left, left.base as number),
				right: right === undefined ? null : toCell(right, right.worktree as number),
			});
			pushThreads(lineKeys(left?.base ?? null, right?.worktree ?? null));
		}
	}
}

/** Lines a row exposes for the cursor and the comment affordance, worktree first. */
export function rowLineRefs(row: DiffRow): DiffLineRef[] {
	if (row.type === "line") {
		const refs: DiffLineRef[] = [];
		if (row.worktree !== null) refs.push({ side: "worktree", line: row.worktree });
		if (row.base !== null) refs.push({ side: "base", line: row.base });
		return refs;
	}
	if (row.type === "split") {
		const refs: DiffLineRef[] = [];
		if (row.right !== null) refs.push({ side: "worktree", line: row.right.line });
		if (row.left !== null) refs.push({ side: "base", line: row.left.line });
		return refs;
	}
	return [];
}

/** The longest line, in columns (tabs count as 4), for the horizontal scroll width. */
export function longestLine(diff: LineDiff, baseLines: readonly SourceLine[]): number {
	let longest = 0;
	const measure = (text: string) => {
		let width = text.length;
		for (const char of text) if (char === "\t") width += 3;
		if (width > longest) longest = width;
	};
	for (const line of baseLines) measure(line.text);
	for (const hunk of diff.hunks) for (const line of hunk.lines) measure(line.text);
	return longest;
}
