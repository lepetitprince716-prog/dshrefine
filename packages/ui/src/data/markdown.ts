/**
 * A small Markdown subset for PR bodies and plan summaries: ATX headings, paragraphs, ordered and
 * unordered (nested) lists, fenced code, inline code, links, bold and italic. Everything else is
 * text. The parser produces a tree; the renderer never emits raw HTML.
 */

export type InlineNode =
	| { readonly type: "text"; readonly value: string }
	| { readonly type: "code"; readonly value: string }
	| { readonly type: "strong"; readonly children: readonly InlineNode[] }
	| { readonly type: "em"; readonly children: readonly InlineNode[] }
	| { readonly type: "link"; readonly href: string; readonly children: readonly InlineNode[] };

export interface ListItem {
	readonly children: readonly BlockNode[];
}

export type BlockNode =
	| {
			readonly type: "heading";
			readonly level: 1 | 2 | 3 | 4 | 5 | 6;
			readonly children: readonly InlineNode[];
	  }
	| { readonly type: "paragraph"; readonly children: readonly InlineNode[] }
	| { readonly type: "code"; readonly lang: string; readonly value: string }
	| {
			readonly type: "list";
			readonly ordered: boolean;
			readonly start: number;
			readonly items: readonly ListItem[];
	  };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
/** Deeper nesting is flattened into text so hostile input cannot exhaust the stack. */
const MAX_LIST_DEPTH = 8;
const MAX_LINK_TEXT = 1000;
const MAX_LINK_URL = 2048;

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const LIST_ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)/;

/** Returns the href when it is an absolute http, https or mailto URL; otherwise null. */
export function safeHref(raw: string): string | null {
	try {
		const url = new URL(raw.trim());
		return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
	} catch {
		return null;
	}
}

export function parseMarkdown(source: string): BlockNode[] {
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	return parseBlocks(lines, 0);
}

function isBlank(line: string): boolean {
	return line.trim() === "";
}

function indentOf(line: string): number {
	let width = 0;
	for (const char of line) {
		if (char === " ") width++;
		else if (char === "\t") width += 4 - (width % 4);
		else break;
	}
	return width;
}

/** Remove `width` columns of leading indentation (tabs count to the next multiple of 4). */
function dedent(line: string, width: number): string {
	let column = 0;
	let index = 0;
	while (index < line.length && column < width) {
		const char = line[index];
		if (char === " ") column++;
		else if (char === "\t") column += 4 - (column % 4);
		else break;
		index++;
	}
	return line.slice(index);
}

function startsBlock(line: string): boolean {
	return FENCE.test(line) || HEADING.test(line) || LIST_ITEM.test(line);
}

function parseBlocks(lines: readonly string[], depth: number): BlockNode[] {
	const blocks: BlockNode[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index] as string;
		if (isBlank(line)) {
			index++;
			continue;
		}
		const fence = FENCE.exec(line);
		if (fence) {
			const marker = fence[1] as string;
			const indent = indentOf(line);
			const body: string[] = [];
			index++;
			while (index < lines.length) {
				const current = lines[index] as string;
				const trimmed = current.trim();
				if (
					trimmed.length >= marker.length &&
					trimmed === (marker[0] as string).repeat(trimmed.length)
				) {
					index++;
					break;
				}
				body.push(dedent(current, indent));
				index++;
			}
			blocks.push({ type: "code", lang: fence[2] ?? "", value: body.join("\n") });
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading) {
			const level = (heading[1] as string).length as 1 | 2 | 3 | 4 | 5 | 6;
			blocks.push({ type: "heading", level, children: parseInline(heading[2] ?? "") });
			index++;
			continue;
		}
		if (depth < MAX_LIST_DEPTH && LIST_ITEM.test(line)) {
			const parsed = parseList(lines, index, depth);
			blocks.push(parsed.block);
			index = parsed.next;
			continue;
		}
		const paragraph: string[] = [line.trim()];
		index++;
		while (index < lines.length) {
			const current = lines[index] as string;
			if (isBlank(current) || (startsBlock(current) && depth < MAX_LIST_DEPTH)) break;
			if (FENCE.test(current) || HEADING.test(current)) break;
			paragraph.push(current.trim());
			index++;
		}
		blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
	}
	return blocks;
}

interface ListMarker {
	readonly ordered: boolean;
	readonly bullet: string;
	readonly number: number;
	/** Column where the item's content starts; continuation lines are indented to it. */
	readonly contentIndent: number;
	readonly first: string;
}

function readMarker(line: string): ListMarker | null {
	const match = LIST_ITEM.exec(line);
	if (!match) return null;
	const marker = match[2] as string;
	const ordered = /\d/.test(marker[0] as string);
	const spacing = match[3] as string;
	const markerEnd = (match[1] as string).length + marker.length;
	// A blank item or wide spacing puts the content one column after the marker.
	const contentIndent =
		spacing === "" || spacing.length > 4 ? markerEnd + 1 : markerEnd + spacing.length;
	const first =
		spacing.length > 4 ? line.slice(markerEnd + 1) : line.slice(markerEnd + spacing.length);
	return {
		ordered,
		bullet: ordered ? (marker.at(-1) as string) : marker,
		number: ordered ? Number.parseInt(marker, 10) : 1,
		contentIndent,
		first,
	};
}

function parseList(
	lines: readonly string[],
	start: number,
	depth: number,
): { block: BlockNode; next: number } {
	const head = readMarker(lines[start] as string) as ListMarker;
	const items: ListItem[] = [];
	let index = start;
	while (index < lines.length) {
		const marker = readMarker(lines[index] as string);
		if (!marker || marker.ordered !== head.ordered || marker.bullet !== head.bullet) break;
		const content: string[] = [marker.first];
		index++;
		let previousBlank = false;
		while (index < lines.length) {
			const current = lines[index] as string;
			if (isBlank(current)) {
				content.push("");
				previousBlank = true;
				index++;
				continue;
			}
			const indent = indentOf(current);
			if (indent >= marker.contentIndent) {
				content.push(dedent(current, marker.contentIndent));
			} else if (!previousBlank && !startsBlock(current)) {
				content.push(current.trim()); // lazy paragraph continuation
			} else {
				break;
			}
			previousBlank = false;
			index++;
		}
		while (content.length > 0 && content.at(-1) === "") content.pop();
		items.push({ children: parseBlocks(content, depth + 1) });
	}
	return {
		block: { type: "list", ordered: head.ordered, start: head.number, items },
		next: index,
	};
}

// ---------------------------------------------------------------------------------------------
// Inline parsing: code spans and links are resolved while scanning; emphasis uses a delimiter
// stack (a reduced form of the CommonMark algorithm) so unbalanced markers stay literal and the
// work stays near linear on hostile input.

interface Delimiter {
	readonly type: "delim";
	readonly char: "*" | "_";
	count: number;
	readonly canOpen: boolean;
	readonly canClose: boolean;
}

type Piece = InlineNode | Delimiter;

const WORD = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;

export function parseInline(text: string, allowLinks = true): InlineNode[] {
	const pieces: Piece[] = [];
	const openers: number[] = []; // indexes into `pieces` of delimiters that may open
	const bottom: Record<"*" | "_", number> = { "*": 0, _: 0 };
	const missingCloser = new Set<number>(); // backtick run lengths known to have no closer
	let buffer = "";
	const flush = () => {
		if (buffer !== "") pieces.push({ type: "text", value: buffer });
		buffer = "";
	};

	let index = 0;
	while (index < text.length) {
		const char = text[index] as string;
		if (
			char === "\\" &&
			index + 1 < text.length &&
			/[!-/:-@[-`{-~]/.test(text[index + 1] as string)
		) {
			buffer += text[index + 1];
			index += 2;
			continue;
		}
		if (char === "`") {
			let run = 1;
			while (text[index + run] === "`") run++;
			const close = missingCloser.has(run) ? -1 : findBacktickRun(text, index + run, run);
			if (close === -1) {
				missingCloser.add(run);
				buffer += "`".repeat(run);
				index += run;
				continue;
			}
			flush();
			let value = text.slice(index + run, close).replace(/\n/g, " ");
			if (value.length > 2 && value.startsWith(" ") && value.endsWith(" ") && value.trim() !== "") {
				value = value.slice(1, -1);
			}
			pieces.push({ type: "code", value });
			index = close + run;
			continue;
		}
		if (char === "[" && allowLinks) {
			const link = readLink(text, index);
			if (link) {
				flush();
				const href = safeHref(link.url);
				if (href === null) {
					pieces.push({ type: "text", value: text.slice(index, link.end) });
				} else {
					pieces.push({ type: "link", href, children: parseInline(link.label, false) });
				}
				index = link.end;
				continue;
			}
		}
		if (char === "*" || char === "_") {
			let run = 1;
			while (text[index + run] === char) run++;
			const before = index === 0 ? " " : (text[index - 1] as string);
			const after = index + run >= text.length ? " " : (text[index + run] as string);
			const leftFlanking = !SPACE.test(after);
			const rightFlanking = !SPACE.test(before);
			// Intraword underscores (snake_case) never emphasize.
			const canOpen = leftFlanking && (char === "*" || !WORD.test(before));
			const canClose = rightFlanking && (char === "*" || !WORD.test(after));
			flush();
			pushDelimiter(pieces, openers, bottom, {
				type: "delim",
				char,
				count: run,
				canOpen,
				canClose,
			});
			index += run;
			continue;
		}
		buffer += char;
		index++;
	}
	flush();
	return finish(pieces);
}

function findBacktickRun(text: string, from: number, run: number): number {
	let index = text.indexOf("`", from);
	while (index !== -1) {
		let length = 1;
		while (text[index + length] === "`") length++;
		if (length === run) return index;
		index = text.indexOf("`", index + length);
	}
	return -1;
}

function readLink(text: string, start: number): { label: string; url: string; end: number } | null {
	let depth = 0;
	let close = -1;
	const labelLimit = Math.min(text.length, start + MAX_LINK_TEXT + 2);
	for (let index = start; index < labelLimit; index++) {
		const char = text[index];
		if (char === "\\") {
			index++;
		} else if (char === "[") {
			depth++;
		} else if (char === "]") {
			depth--;
			if (depth === 0) {
				close = index;
				break;
			}
		}
	}
	if (close === -1 || text[close + 1] !== "(") return null;
	let parens = 0;
	const urlLimit = Math.min(text.length, close + 2 + MAX_LINK_URL);
	for (let index = close + 2; index < urlLimit; index++) {
		const char = text[index] as string;
		if (SPACE.test(char)) return null;
		if (char === "(") parens++;
		else if (char === ")") {
			if (parens === 0) {
				return {
					label: text.slice(start + 1, close),
					url: text.slice(close + 2, index),
					end: index + 1,
				};
			}
			parens--;
		}
	}
	return null;
}

function pushDelimiter(
	pieces: Piece[],
	openers: number[],
	bottom: Record<"*" | "_", number>,
	closer: Delimiter,
): void {
	if (closer.canClose) {
		while (closer.count > 0) {
			let match = -1;
			for (let index = openers.length - 1; index >= bottom[closer.char]; index--) {
				const candidate = pieces[openers[index] as number] as Delimiter;
				if (candidate.char === closer.char) {
					match = index;
					break;
				}
			}
			if (match === -1) {
				// No opener below this point: later closers of this char need not look again.
				bottom[closer.char] = openers.length;
				break;
			}
			const openerAt = openers[match] as number;
			const opener = pieces[openerAt] as Delimiter;
			const use = opener.count >= 2 && closer.count >= 2 ? 2 : 1;
			const inner = finish(pieces.splice(openerAt + 1));
			openers.length = match + 1;
			opener.count -= use;
			closer.count -= use;
			if (opener.count === 0) {
				pieces.pop();
				openers.pop();
			}
			for (const key of ["*", "_"] as const) bottom[key] = Math.min(bottom[key], openers.length);
			pieces.push(
				use === 2 ? { type: "strong", children: inner } : { type: "em", children: inner },
			);
		}
	}
	if (closer.count === 0) return;
	if (closer.canOpen) {
		pieces.push(closer);
		openers.push(pieces.length - 1);
	} else {
		pieces.push({ type: "text", value: closer.char.repeat(closer.count) });
	}
}

function literal(piece: Piece): InlineNode {
	return piece.type === "delim" ? { type: "text", value: piece.char.repeat(piece.count) } : piece;
}

function finish(pieces: readonly Piece[]): InlineNode[] {
	const out: InlineNode[] = [];
	for (const piece of pieces) {
		const node = literal(piece);
		const last = out.at(-1);
		if (node.type === "text" && last?.type === "text") {
			out[out.length - 1] = { type: "text", value: last.value + node.value };
		} else {
			out.push(node);
		}
	}
	return out;
}
