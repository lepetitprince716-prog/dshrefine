import { diffSequences } from "./myers.ts";

/** Lines longer than this (in UTF-16 units) get no intra-line highlight. */
export const INLINE_DIFF_MAX_LENGTH = 500;

export interface InlineSegment {
	readonly text: string;
	readonly changed: boolean;
}

export interface WordDiff {
	readonly base: readonly InlineSegment[];
	readonly worktree: readonly InlineSegment[];
}

// Words (letters, digits, underscore), whitespace runs, and every other character on its own.
const TOKEN = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu;

export function tokenizeWords(line: string): string[] {
	return line.match(TOKEN) ?? [];
}

/**
 * Word-level diff of a paired deleted and added line, using the same Myers core as the line diff.
 * Returns null when either line exceeds `maxLength`.
 */
export function computeWordDiff(
	baseLine: string,
	worktreeLine: string,
	maxLength: number = INLINE_DIFF_MAX_LENGTH,
): WordDiff | null {
	if (baseLine.length > maxLength || worktreeLine.length > maxLength) return null;
	const baseTokens = tokenizeWords(baseLine);
	const worktreeTokens = tokenizeWords(worktreeLine);
	const ids = new Map<string, number>();
	const toIds = (tokens: readonly string[]) =>
		Int32Array.from(tokens, (token) => {
			let id = ids.get(token);
			if (id === undefined) {
				id = ids.size;
				ids.set(token, id);
			}
			return id;
		});
	const result = diffSequences(toIds(baseTokens), toIds(worktreeTokens));
	if (result === null) return null;
	return {
		base: segments(baseTokens, result.aChanged),
		worktree: segments(worktreeTokens, result.bChanged),
	};
}

function segments(tokens: readonly string[], changed: Uint8Array): InlineSegment[] {
	const out: InlineSegment[] = [];
	let text = "";
	let current = false;
	tokens.forEach((token, index) => {
		const isChanged = changed[index] === 1;
		if (text !== "" && isChanged !== current) {
			out.push({ text, changed: current });
			text = "";
		}
		current = isChanged;
		text += token;
	});
	if (text !== "") out.push({ text, changed: current });
	return out;
}
