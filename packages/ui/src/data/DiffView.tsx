// biome-ignore-all lint/a11y/useSemanticElements: rows are absolutely positioned by the virtualizer, so table elements cannot be used; the ARIA grid pattern is applied by role.
// biome-ignore-all lint/a11y/useFocusableInteractive: focus stays on the grid, which tracks the line cursor with aria-activedescendant.
import { useVirtualizer, type VirtualizerOptions } from "@tanstack/react-virtual";
import {
	type CSSProperties,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { Icon } from "../icons/index.ts";
import { computeLineDiff, type LineDiff, type LineDiffOptions, splitLines } from "./diff.ts";
import {
	buildDiffRows,
	type DiffLineKey,
	type DiffLineRange,
	type DiffLineRef,
	type DiffMode,
	type DiffRow,
	type DiffSide,
	longestLine,
	rowLineRefs,
	type SplitCell,
	type UnifiedLineRow,
} from "./diffRows.ts";
import { computeWordDiff, type InlineSegment } from "./wordDiff.ts";

export interface DiffViewLabels {
	/** Accessible name of the diff grid. */
	readonly grid: string;
	/** Accessible name of the gutter "+" button. */
	readonly addComment: string;
	/** Text of a collapsed-context row, for example "Show 42 unchanged lines". */
	readonly expand: (count: number) => string;
	/** Notice shown when the diff fell back to one replace-everything hunk. */
	readonly truncated?: string;
	/** Marker after a final line without a newline. */
	readonly noNewline?: string;
	/** Shown when both sides are empty. */
	readonly empty?: string;
}

/** Measurement hooks forwarded to the virtualizer (DOM tests and embedders that size it). */
export type DiffViewVirtualizerOverrides = Partial<
	Pick<
		VirtualizerOptions<HTMLDivElement, Element>,
		"initialRect" | "observeElementRect" | "observeElementOffset" | "overscan"
	>
>;

export interface DiffViewProps {
	readonly original: string;
	readonly modified: string;
	/** Precomputed diff of the same texts; computed from them when absent. */
	readonly diff?: LineDiff;
	readonly diffOptions?: LineDiffOptions;
	readonly mode?: DiffMode;
	readonly labels: DiffViewLabels;
	/** The line under the pointer in a gutter, or null when the pointer leaves it. */
	readonly onGutterHover?: (ref: DiffLineRef | null) => void;
	/** A gutter "+" click, shift-click or drag; enables the "+" affordance. */
	readonly onAddComment?: (range: DiffLineRange) => void;
	/** Content inserted as a variable-height row below each anchored line. */
	readonly renderThread?: (anchorKey: DiffLineKey) => ReactNode;
	/** Lines that have threads (keys from `lineKey`). */
	readonly threadsByLine?: ReadonlySet<DiffLineKey>;
	readonly virtualizer?: DiffViewVirtualizerOverrides;
	readonly className?: string;
}

const ROW_HEIGHT = 20;
const THREAD_ESTIMATE = 96;
const PAGE_ROWS = 20;
const NO_THREADS: ReadonlySet<DiffLineKey> = new Set();
const NO_GAPS: ReadonlySet<number> = new Set();

interface Drag {
	readonly side: DiffSide;
	readonly anchor: number;
	end: number;
}

function rangeOf(drag: Drag): DiffLineRange {
	return {
		side: drag.side,
		startLine: Math.min(drag.anchor, drag.end),
		endLine: Math.max(drag.anchor, drag.end),
	};
}

function isCursorRow(row: DiffRow | undefined): boolean {
	return row?.type === "line" || row?.type === "split" || row?.type === "gap";
}

export function DiffView(props: DiffViewProps) {
	const { original, modified, mode = "unified", labels, renderThread } = props;
	const diff = useMemo(
		() => props.diff ?? computeLineDiff(original, modified, props.diffOptions),
		[props.diff, original, modified, props.diffOptions],
	);
	const baseLines = useMemo(() => splitLines(original), [original]);
	const threads = renderThread === undefined ? NO_THREADS : (props.threadsByLine ?? NO_THREADS);

	// Expanded gaps belong to one diff; a new diff starts collapsed.
	const [expansion, setExpansion] = useState<{ diff: LineDiff; gaps: ReadonlySet<number> }>({
		diff,
		gaps: NO_GAPS,
	});
	const expanded = expansion.diff === diff ? expansion.gaps : NO_GAPS;
	const expandGap = (gap: number) => setExpansion({ diff, gaps: new Set([...expanded, gap]) });

	const rows = useMemo(
		() => buildDiffRows({ diff, baseLines, mode, expanded, threads }),
		[diff, baseLines, mode, expanded, threads],
	);
	const columns = useMemo(() => longestLine(diff, baseLines), [diff, baseLines]);
	const digits = Math.max(3, String(Math.max(diff.baseLineCount, diff.worktreeLineCount)).length);

	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: (index) => (rows[index]?.type === "thread" ? THREAD_ESTIMATE : ROW_HEIGHT),
		getItemKey: (index) => rowKey(rows[index], index),
		overscan: 16,
		...props.virtualizer,
	});

	const [cursor, setCursor] = useState(-1);
	const [selection, setSelection] = useState<DiffLineRange | null>(null);
	const dragRef = useRef<Drag | null>(null);
	const anchorRef = useRef<DiffLineRef | null>(null);
	const latest = useRef(props);
	latest.current = props;

	useEffect(() => {
		if (cursor >= 0 && cursor < rows.length) virtualizer.scrollToIndex(cursor, { align: "auto" });
	}, [cursor, rows.length, virtualizer]);

	const finishDrag = () => {
		const drag = dragRef.current;
		if (drag === null) return;
		dragRef.current = null;
		setSelection(null);
		anchorRef.current = { side: drag.side, line: drag.anchor };
		latest.current.onAddComment?.(rangeOf(drag));
	};

	const comments: CommentHandlers | null =
		props.onAddComment === undefined
			? null
			: {
					label: labels.addComment,
					start(ref, shift) {
						const prior = anchorRef.current;
						const anchor =
							shift && prior !== null && prior.side === ref.side ? prior.line : ref.line;
						dragRef.current = { side: ref.side, anchor, end: ref.line };
						setSelection(rangeOf(dragRef.current));
						window.addEventListener("mouseup", finishDrag, { once: true });
					},
					extend(row) {
						const drag = dragRef.current;
						if (drag === null) return;
						const ref = rowLineRefs(row).find((candidate) => candidate.side === drag.side);
						if (ref === undefined || ref.line === drag.end) return;
						drag.end = ref.line;
						setSelection(rangeOf(drag));
					},
					activate(ref, shift) {
						const prior = anchorRef.current;
						const anchor =
							shift && prior !== null && prior.side === ref.side ? prior.line : ref.line;
						anchorRef.current = shift ? prior : ref;
						latest.current.onAddComment?.(rangeOf({ side: ref.side, anchor, end: ref.line }));
					},
				};

	const hover = (ref: DiffLineRef | null) => latest.current.onGutterHover?.(ref);

	const moveCursor = (from: number, step: number) => {
		let index = from;
		for (;;) {
			const next = index + step;
			if (next < 0 || next >= rows.length) return index;
			index = next;
			if (isCursorRow(rows[index])) return index;
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget) return;
		const first = moveCursor(-1, 1);
		const last = moveCursor(rows.length, -1);
		let next: number | null = null;
		switch (event.key) {
			case "ArrowDown":
				next = cursor < 0 ? first : moveCursor(cursor, 1);
				break;
			case "ArrowUp":
				next = cursor < 0 ? first : moveCursor(cursor, -1);
				break;
			case "PageDown":
				next =
					cursor < 0 ? first : clampToCursorRow(Math.min(rows.length - 1, cursor + PAGE_ROWS), -1);
				break;
			case "PageUp":
				next = cursor < 0 ? first : clampToCursorRow(Math.max(0, cursor - PAGE_ROWS), 1);
				break;
			case "Home":
				next = first;
				break;
			case "End":
				next = last;
				break;
			case "Enter": {
				const row = rows[cursor];
				if (row?.type === "gap") expandGap(row.gap);
				else if (row !== undefined && comments !== null) {
					const [ref] = rowLineRefs(row);
					if (ref !== undefined) comments.activate(ref, false);
				}
				event.preventDefault();
				return;
			}
			default:
				return;
		}
		event.preventDefault();
		if (next !== null && isCursorRow(rows[next])) setCursor(next);
	};

	const clampToCursorRow = (index: number, step: number) =>
		isCursorRow(rows[index]) ? index : moveCursor(index, step);

	const baseId = useId();
	const rowId = (index: number) => `${baseId}-r${index}`;
	const numWidth = `${digits + 2}ch`;
	const halfWidth = `calc(${columns}ch + ${digits + 2}ch + 56px)`;
	const canvasStyle: CSSProperties = {
		height: virtualizer.getTotalSize(),
		minWidth:
			mode === "split" ? `calc(2 * (${halfWidth}))` : `calc(${columns}ch + 2 * ${numWidth} + 56px)`,
	};

	const context: RowContext = {
		mode,
		labels,
		numWidth,
		halfWidth,
		selection,
		comments,
		hover,
		renderThread,
		expandGap,
	};

	const classes = ["rf-diff", `rf-diff--${mode}`, props.className ?? ""].filter(Boolean).join(" ");
	return (
		<div className={classes}>
			{diff.truncated && labels.truncated !== undefined ? (
				<div className="rf-diff-notice" role="note">
					<Icon name="warning" />
					<span>{labels.truncated}</span>
				</div>
			) : null}
			{rows.length === 0 && labels.empty !== undefined ? (
				<div className="rf-diff-empty">{labels.empty}</div>
			) : null}
			<div
				ref={scrollRef}
				className="rf-diff-scroll"
				role="grid"
				tabIndex={0}
				aria-label={labels.grid}
				aria-rowcount={rows.length}
				aria-colcount={mode === "split" ? 2 : 1}
				aria-activedescendant={cursor >= 0 ? rowId(cursor) : undefined}
				onKeyDown={onKeyDown}
			>
				<div className="rf-diff-canvas" role="rowgroup" style={canvasStyle}>
					{virtualizer.getVirtualItems().map((item) => {
						const row = rows[item.index];
						if (row === undefined) return null;
						return (
							<RowView
								key={item.key}
								id={rowId(item.index)}
								index={item.index}
								row={row}
								start={item.start}
								isCursor={item.index === cursor}
								context={context}
								measure={row.type === "thread" ? virtualizer.measureElement : undefined}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function rowKey(row: DiffRow | undefined, index: number): string {
	if (row === undefined) return `x${index}`;
	switch (row.type) {
		case "line":
			return `l${row.base ?? ""}:${row.worktree ?? ""}`;
		case "split":
			return `s${row.left?.line ?? ""}:${row.right?.line ?? ""}`;
		case "gap":
			return `g${row.gap}`;
		case "hunk":
			return `h${row.header}`;
		case "thread":
			return `t${row.key}`;
	}
}

interface CommentHandlers {
	readonly label: string;
	start(ref: DiffLineRef, shift: boolean): void;
	extend(row: DiffRow): void;
	activate(ref: DiffLineRef, shift: boolean): void;
}

interface RowContext {
	readonly mode: DiffMode;
	readonly labels: DiffViewLabels;
	readonly numWidth: string;
	readonly halfWidth: string;
	readonly selection: DiffLineRange | null;
	readonly comments: CommentHandlers | null;
	readonly hover: (ref: DiffLineRef | null) => void;
	readonly renderThread: ((anchorKey: DiffLineKey) => ReactNode) | undefined;
	readonly expandGap: (gap: number) => void;
}

interface RowViewProps {
	readonly id: string;
	readonly index: number;
	readonly row: DiffRow;
	readonly start: number;
	readonly isCursor: boolean;
	readonly context: RowContext;
	readonly measure: ((node: Element | null) => void) | undefined;
}

function isSelected(selection: DiffLineRange | null, side: DiffSide, line: number | null): boolean {
	return (
		selection !== null &&
		line !== null &&
		selection.side === side &&
		line >= selection.startLine &&
		line <= selection.endLine
	);
}

function RowView({ id, index, row, start, isCursor, context, measure }: RowViewProps) {
	const style: CSSProperties = { transform: `translateY(${start}px)` };
	const common = {
		id,
		"aria-rowindex": index + 1,
		"data-index": index,
		style,
	};
	const cursorClass = isCursor ? " rf-diff-row--cursor" : "";
	switch (row.type) {
		case "thread":
			return (
				<div {...common} role="row" ref={measure} className="rf-diff-row rf-diff-thread">
					<div role="gridcell" className="rf-diff-thread-body">
						{context.renderThread?.(row.key)}
					</div>
				</div>
			);
		case "hunk":
			return (
				<div {...common} role="row" className="rf-diff-row rf-diff-hunk">
					<span role="gridcell" className="rf-diff-hunk-text">
						{row.header}
					</span>
				</div>
			);
		case "gap":
			return (
				<div {...common} role="row" className={`rf-diff-row rf-diff-gap${cursorClass}`}>
					<span role="gridcell" className="rf-diff-gap-cell">
						<button
							type="button"
							className="rf-diff-expand"
							tabIndex={-1}
							onClick={() => context.expandGap(row.gap)}
						>
							<Icon name="chevron-down" size={14} />
							<span>{context.labels.expand(row.count)}</span>
						</button>
						{row.header === null ? null : <span className="rf-diff-hunk-text">{row.header}</span>}
					</span>
				</div>
			);
		case "line":
			return <UnifiedRow common={common} row={row} cursorClass={cursorClass} context={context} />;
		case "split":
			return (
				<div {...common} role="row" className={`rf-diff-row rf-diff-split${cursorClass}`}>
					<SplitHalf side="base" cell={row.left} row={row} context={context} />
					<SplitHalf side="worktree" cell={row.right} row={row} context={context} />
				</div>
			);
	}
}

const MARKERS = { context: " ", added: "+", deleted: "−" } as const;

function UnifiedRow({
	common,
	row,
	cursorClass,
	context,
}: {
	common: Record<string, unknown>;
	row: UnifiedLineRow;
	cursorClass: string;
	context: RowContext;
}) {
	const [ref] = rowLineRefs(row);
	const selected =
		isSelected(context.selection, "base", row.base) ||
		isSelected(context.selection, "worktree", row.worktree);
	return (
		<div
			{...common}
			role="row"
			className={`rf-diff-row rf-diff-line rf-diff-line--${row.kind}${cursorClass}${selected ? " rf-diff-row--selected" : ""}`}
			aria-selected={selected || undefined}
			onMouseEnter={() => context.comments?.extend(row)}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover reporting only, no action */}
			<span
				className="rf-diff-gutter"
				onMouseEnter={() => context.hover(ref ?? null)}
				onMouseLeave={() => context.hover(null)}
			>
				<span role="gridcell" className="rf-diff-num" style={{ width: context.numWidth }}>
					{row.base ?? ""}
				</span>
				<span role="gridcell" className="rf-diff-num" style={{ width: context.numWidth }}>
					{row.worktree ?? ""}
				</span>
				<AddButton lineRef={ref} context={context} />
				<span className="rf-diff-marker" aria-hidden="true">
					{MARKERS[row.kind]}
				</span>
			</span>
			<LineText
				kind={row.kind}
				text={row.text}
				partner={row.partner}
				noNewline={row.noNewline}
				noNewlineLabel={context.labels.noNewline}
			/>
		</div>
	);
}

function SplitHalf({
	side,
	cell,
	row,
	context,
}: {
	side: DiffSide;
	cell: SplitCell | null;
	row: DiffRow;
	context: RowContext;
}) {
	if (cell === null) {
		return (
			<span
				className="rf-diff-half rf-diff-half--empty"
				style={{ minWidth: context.halfWidth }}
				role="gridcell"
			/>
		);
	}
	const ref: DiffLineRef = { side, line: cell.line };
	const selected = isSelected(context.selection, side, cell.line);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drag extension only, no action
		<span
			className={`rf-diff-half rf-diff-line--${cell.kind}${selected ? " rf-diff-row--selected" : ""}`}
			style={{ minWidth: context.halfWidth }}
			onMouseEnter={() => context.comments?.extend(row)}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover reporting only, no action */}
			<span
				className="rf-diff-gutter"
				onMouseEnter={() => context.hover(ref)}
				onMouseLeave={() => context.hover(null)}
			>
				<span role="gridcell" className="rf-diff-num" style={{ width: context.numWidth }}>
					{cell.line}
				</span>
				<AddButton lineRef={ref} context={context} />
				<span className="rf-diff-marker" aria-hidden="true">
					{MARKERS[cell.kind]}
				</span>
			</span>
			<LineText
				kind={cell.kind}
				text={cell.text}
				partner={cell.partner}
				noNewline={cell.noNewline}
				noNewlineLabel={context.labels.noNewline}
			/>
		</span>
	);
}

function AddButton({
	lineRef,
	context,
}: {
	lineRef: DiffLineRef | undefined;
	context: RowContext;
}) {
	const { comments } = context;
	if (comments === null || lineRef === undefined) return <span className="rf-diff-add-slot" />;
	return (
		<span className="rf-diff-add-slot">
			<button
				type="button"
				className="rf-diff-add"
				tabIndex={-1}
				aria-label={comments.label}
				data-side={lineRef.side}
				data-line={lineRef.line}
				onMouseDown={(event: MouseEvent) => {
					if (event.button !== 0) return;
					event.preventDefault();
					comments.start(lineRef, event.shiftKey);
				}}
				onClick={(event) => {
					// Mouse clicks are handled by mousedown/mouseup; detail 0 is keyboard activation.
					if (event.detail === 0) comments.activate(lineRef, event.shiftKey);
				}}
			>
				<Icon name="plus" size={12} />
			</button>
		</span>
	);
}

function LineText({
	kind,
	text,
	partner,
	noNewline,
	noNewlineLabel,
}: {
	kind: UnifiedLineRow["kind"];
	text: string;
	partner: string | null;
	noNewline: boolean;
	noNewlineLabel: string | undefined;
}) {
	const segments = useMemo((): readonly InlineSegment[] | null => {
		if (partner === null || kind === "context") return null;
		const words =
			kind === "deleted" ? computeWordDiff(text, partner) : computeWordDiff(partner, text);
		if (words === null) return null;
		return kind === "deleted" ? words.base : words.worktree;
	}, [kind, text, partner]);
	return (
		<span role="gridcell" className="rf-diff-text">
			{segments === null
				? text
				: segments.map((segment, index) =>
						segment.changed ? (
							// biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
							<span key={index} className="rf-diff-word">
								{segment.text}
							</span>
						) : (
							segment.text
						),
					)}
			{noNewline && noNewlineLabel !== undefined ? (
				<span className="rf-diff-noeol">{noNewlineLabel}</span>
			) : null}
		</span>
	);
}
