import { type CSSProperties, type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { ChevronRightGlyph } from "./glyphs.tsx";
import { cx, edgeEnabled, nextEnabled } from "./util.ts";

export interface ListItemBase {
	readonly id: string;
	readonly disabled?: boolean;
}

export interface RowState {
	readonly selected: boolean;
	readonly focused: boolean;
	readonly disabled: boolean;
}

export interface ListProps<T extends ListItemBase> {
	readonly items: readonly T[];
	readonly selectedId?: string | null;
	/** Click, Enter or Space on an enabled row. */
	readonly onSelect?: (id: string, item: T) => void;
	readonly renderItem: (item: T, state: RowState) => ReactNode;
	/** Accessible name of the listbox. */
	readonly label: string;
	/** Rendered instead of the listbox when `items` is empty. */
	readonly emptyState?: ReactNode;
	readonly className?: string;
}

/** Roving tabindex: the remembered row if it is still enabled, else the selection, else the first. */
function tabbableIndex(
	disabled: readonly boolean[],
	ids: readonly string[],
	...prefer: readonly (string | null | undefined)[]
): number {
	for (const id of prefer) {
		const index = id === null || id === undefined ? -1 : ids.indexOf(id);
		if (index >= 0 && disabled[index] === false) return index;
	}
	return edgeEnabled(disabled, 1);
}

function stepFor(key: string, disabled: readonly boolean[], index: number): number | null {
	if (key === "ArrowDown") return nextEnabled(disabled, index, 1, false);
	if (key === "ArrowUp") return nextEnabled(disabled, index, -1, false);
	if (key === "Home") return edgeEnabled(disabled, 1);
	if (key === "End") return edgeEnabled(disabled, -1);
	return null;
}

/**
 * Single-select `role="listbox"` of focusable rows (`aria-selected`). One row is in the tab
 * order; arrows, Home and End move focus, Enter and Space select.
 */
export function List<T extends ListItemBase>({
	items,
	selectedId,
	onSelect,
	renderItem,
	label,
	emptyState,
	className,
}: ListProps<T>) {
	const rows = useRef(new Map<string, HTMLDivElement>());
	const [focusId, setFocusId] = useState<string | null>(null);
	if (items.length === 0 && emptyState !== undefined) return <>{emptyState}</>;
	const ids = items.map((item) => item.id);
	const disabled = items.map((item) => item.disabled === true);
	const tabbable = tabbableIndex(disabled, ids, focusId, selectedId);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number, item: T): void => {
		if ((event.key === "Enter" || event.key === " ") && item.disabled !== true) {
			event.preventDefault();
			onSelect?.(item.id, item);
			return;
		}
		const next = stepFor(event.key, disabled, index);
		if (next === null) return;
		event.preventDefault();
		const target = items[next];
		if (target === undefined) return;
		setFocusId(target.id);
		rows.current.get(target.id)?.focus();
	};

	return (
		<div role="listbox" aria-label={label} className={cx("rf-list", className)}>
			{items.map((item, index) => {
				const state: RowState = {
					selected: item.id === selectedId,
					focused: item.id === focusId,
					disabled: item.disabled === true,
				};
				return (
					<div
						key={item.id}
						ref={(node) => {
							if (node === null) rows.current.delete(item.id);
							else rows.current.set(item.id, node);
						}}
						role="option"
						className="rf-row"
						tabIndex={index === tabbable ? 0 : -1}
						aria-selected={state.selected}
						aria-disabled={state.disabled || undefined}
						onFocus={() => setFocusId(item.id)}
						onClick={() => {
							if (!state.disabled) onSelect?.(item.id, item);
						}}
						onKeyDown={(event) => onKeyDown(event, index, item)}
					>
						{renderItem(item, state)}
					</div>
				);
			})}
		</div>
	);
}

export interface TreeNode {
	readonly id: string;
	readonly label: ReactNode;
	readonly children?: readonly TreeNode[];
	readonly disabled?: boolean;
	readonly icon?: ReactNode;
	/** Content at the end of the row (counts, chips). */
	readonly trailing?: ReactNode;
}

export interface TreeProps {
	readonly nodes: readonly TreeNode[];
	readonly expandedIds: ReadonlySet<string>;
	readonly onExpandedChange: (id: string, expanded: boolean) => void;
	readonly selectedId?: string | null;
	readonly onSelect?: (id: string, node: TreeNode) => void;
	/** Accessible name of the tree. */
	readonly label: string;
	readonly className?: string;
}

interface VisibleNode {
	readonly node: TreeNode;
	readonly level: number;
	readonly parentId: string | null;
	readonly position: number;
	readonly siblings: number;
}

function visibleNodes(nodes: readonly TreeNode[], expanded: ReadonlySet<string>): VisibleNode[] {
	const out: VisibleNode[] = [];
	const walk = (list: readonly TreeNode[], level: number, parentId: string | null): void => {
		list.forEach((node, index) => {
			out.push({ node, level, parentId, position: index + 1, siblings: list.length });
			if (node.children !== undefined && node.children.length > 0 && expanded.has(node.id)) {
				walk(node.children, level + 1, node.id);
			}
		});
	};
	walk(nodes, 1, null);
	return out;
}

const hasChildren = (node: TreeNode): boolean =>
	node.children !== undefined && node.children.length > 0;

/**
 * `role="tree"` with roving focus. Up and Down move between visible rows, Right expands a
 * collapsed parent or moves to its first child, Left collapses an expanded parent or moves to
 * the parent, Home and End jump, Enter and Space select.
 */
export function Tree({
	nodes,
	expandedIds,
	onExpandedChange,
	selectedId,
	onSelect,
	label,
	className,
}: TreeProps) {
	const rows = useRef(new Map<string, HTMLDivElement>());
	const [focusId, setFocusId] = useState<string | null>(null);
	const visible = visibleNodes(nodes, expandedIds);
	const ids = visible.map((entry) => entry.node.id);
	const disabled = visible.map((entry) => entry.node.disabled === true);
	const tabbable = tabbableIndex(disabled, ids, focusId, selectedId);

	const focusRow = (id: string | undefined): void => {
		if (id === undefined) return;
		setFocusId(id);
		rows.current.get(id)?.focus();
	};

	const onKeyDown = (
		event: KeyboardEvent<HTMLDivElement>,
		index: number,
		entry: VisibleNode,
	): void => {
		const { node } = entry;
		const isExpanded = expandedIds.has(node.id);
		let handled = true;
		if (event.key === "Enter" || event.key === " ") {
			if (node.disabled !== true) onSelect?.(node.id, node);
		} else if (event.key === "ArrowRight") {
			if (hasChildren(node) && !isExpanded) onExpandedChange(node.id, true);
			else if (hasChildren(node)) focusRow(visible[index + 1]?.node.id);
		} else if (event.key === "ArrowLeft") {
			if (hasChildren(node) && isExpanded) onExpandedChange(node.id, false);
			else if (entry.parentId !== null) focusRow(entry.parentId);
		} else {
			const next = stepFor(event.key, disabled, index);
			if (next === null) handled = false;
			else focusRow(visible[next]?.node.id);
		}
		if (handled) event.preventDefault();
	};

	return (
		<div role="tree" aria-label={label} className={cx("rf-tree", className)}>
			{visible.map((entry, index) => {
				const { node } = entry;
				const parent = hasChildren(node);
				const isExpanded = parent && expandedIds.has(node.id);
				return (
					<div
						key={node.id}
						ref={(element) => {
							if (element === null) rows.current.delete(node.id);
							else rows.current.set(node.id, element);
						}}
						role="treeitem"
						className="rf-row rf-tree-row"
						style={{ "--rf-tree-level": entry.level - 1 } as CSSProperties}
						tabIndex={index === tabbable ? 0 : -1}
						aria-level={entry.level}
						aria-posinset={entry.position}
						aria-setsize={entry.siblings}
						aria-expanded={parent ? isExpanded : undefined}
						aria-selected={node.id === selectedId}
						aria-disabled={node.disabled || undefined}
						onFocus={() => setFocusId(node.id)}
						onClick={() => {
							if (node.disabled !== true) onSelect?.(node.id, node);
						}}
						onKeyDown={(event) => onKeyDown(event, index, entry)}
					>
						{parent ? (
							<span
								className="rf-tree-toggle"
								data-expanded={isExpanded || undefined}
								aria-hidden="true"
								onClick={(event) => {
									event.stopPropagation();
									onExpandedChange(node.id, !isExpanded);
								}}
							>
								<ChevronRightGlyph />
							</span>
						) : (
							<span className="rf-tree-toggle" aria-hidden="true" />
						)}
						{node.icon === undefined ? null : (
							<span className="rf-tree-glyph" aria-hidden="true">
								{node.icon}
							</span>
						)}
						<span className="rf-tree-label">{node.label}</span>
						{node.trailing === undefined ? null : (
							<span className="rf-tree-trailing">{node.trailing}</span>
						)}
					</div>
				);
			})}
		</div>
	);
}
