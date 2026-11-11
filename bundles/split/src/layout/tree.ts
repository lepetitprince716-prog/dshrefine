// The split layout model: a binary tree of panes, pure data plus pure functions.
//
// Adapted from rainfd/dsh-split-pane 0.1.0 `src/client/contract/layout.ts` (commit 6b4f9ca,
// MIT, Copyright (c) 2026 dsh-split-pane contributors). Changes: panes carry a stable id (the
// render key, so closing a sibling never remounts a pane), operations address panes by id
// instead of by path, the ratio band is 0.1-0.9, and focus history follows herdr's
// `prev_focus` rules (herdr `src/layout.rs`, Apache-2.0, read and rewritten). Moving and swapping
// panes follow yuloop/dsh-web-split (MIT), and balanced runs follow VS Code's
// `workbench.editor.splitSizing: auto` behaviour; both rewritten.

/** Opaque pane identity; stable for the pane's whole life. */
export type PaneId = string;

/** Session identity as the host spells it. */
export type SessionId = string;

/** `row` places the children side by side; `column` stacks them. */
export type SplitAxis = "row" | "column";

/** Where a pane lands next to another one. */
export type Side = "left" | "right" | "top" | "bottom";

/** The axis of the split a side creates. */
export function sideAxis(side: Side): SplitAxis {
	return side === "left" || side === "right" ? "row" : "column";
}

/** Whether a pane placed on this side becomes the split's first child. */
export function sideLeads(side: Side): boolean {
	return side === "left" || side === "top";
}

/** One pane: the leaf that renders a Session, or the session picker when it has none. */
export interface PaneLeaf {
	readonly kind: "pane";
	readonly id: PaneId;
	readonly sessionId: SessionId | undefined;
}

/** One split: two children sharing an axis; `ratio` is the first child's share. */
export interface PaneSplit {
	readonly kind: "split";
	readonly axis: SplitAxis;
	readonly ratio: number;
	readonly first: PaneNode;
	readonly second: PaneNode;
}

export type PaneNode = PaneLeaf | PaneSplit;

/** The tree plus focus. `previous` is the one-slot history consumed when the focused pane closes. */
export interface LayoutState {
	readonly root: PaneNode;
	readonly focus: PaneId;
	readonly previous: PaneId | undefined;
}

export const MIN_RATIO = 0.1;
export const MAX_RATIO = 0.9;
/** Largest number of panes one layout may hold. */
export const MAX_PANES = 8;

/** One pane in reading order with its address from the root (0 = first child, 1 = second). */
export interface PaneDescriptor {
	readonly id: PaneId;
	readonly sessionId: SessionId | undefined;
	readonly path: readonly number[];
}

export function leaf(id: PaneId, sessionId?: SessionId): PaneLeaf {
	return { kind: "pane", id, sessionId };
}

export function split(axis: SplitAxis, first: PaneNode, second: PaneNode, ratio = 0.5): PaneSplit {
	return { kind: "split", axis, ratio: clampRatio(ratio), first, second };
}

/** Clamp a share into the allowed band; a non-finite value becomes an even split. */
export function clampRatio(ratio: number): number {
	if (!Number.isFinite(ratio)) return 0.5;
	return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

/** The node at a path, or `undefined` when the path does not resolve. */
export function nodeAt(root: PaneNode, path: readonly number[]): PaneNode | undefined {
	let node: PaneNode = root;
	for (const step of path) {
		if (node.kind !== "split") return undefined;
		node = step === 0 ? node.first : node.second;
	}
	return node;
}

/** Every pane in reading order. */
export function panes(root: PaneNode): readonly PaneDescriptor[] {
	const found: PaneDescriptor[] = [];
	const walk = (node: PaneNode, path: readonly number[]): void => {
		if (node.kind === "pane") {
			found.push({ id: node.id, sessionId: node.sessionId, path });
			return;
		}
		walk(node.first, [...path, 0]);
		walk(node.second, [...path, 1]);
	};
	walk(root, []);
	return found;
}

export function paneCount(root: PaneNode): number {
	return root.kind === "pane" ? 1 : paneCount(root.first) + paneCount(root.second);
}

export function findPane(root: PaneNode, id: PaneId): PaneLeaf | undefined {
	if (root.kind === "pane") return root.id === id ? root : undefined;
	return findPane(root.first, id) ?? findPane(root.second, id);
}

/** The pane showing a Session; at most one pane shows any Session. */
export function paneOfSession(root: PaneNode, sessionId: SessionId): PaneId | undefined {
	return panes(root).find((pane) => pane.sessionId === sessionId)?.id;
}

/** The address of a pane from the root, or `undefined` when it is missing. */
export function pathOf(root: PaneNode, id: PaneId): readonly number[] | undefined {
	return panes(root).find((pane) => pane.id === id)?.path;
}

// Balanced runs. A run is a maximal chain of splits on one axis, such as three columns built
// from two nested row splits; a child split on the other axis counts as one unit of the run.
// A balanced run gives every unit the same share.

const BALANCE_EPSILON = 0.01;

function runUnits(node: PaneNode, axis: SplitAxis): number {
	return node.kind === "split" && node.axis === axis
		? runUnits(node.first, axis) + runUnits(node.second, axis)
		: 1;
}

/** Climb from `path` while the parent splits on `axis`: the address of the run's top node. */
function runTop(root: PaneNode, path: readonly number[], axis: SplitAxis): readonly number[] {
	let top = path;
	while (top.length > 0) {
		const parent = nodeAt(root, top.slice(0, -1));
		if (parent?.kind !== "split" || parent.axis !== axis) break;
		top = top.slice(0, -1);
	}
	return top;
}

function runIsBalanced(node: PaneNode, axis: SplitAxis): boolean {
	if (node.kind !== "split" || node.axis !== axis) return true;
	const even = runUnits(node.first, axis) / runUnits(node, axis);
	return (
		Math.abs(node.ratio - clampRatio(even)) < BALANCE_EPSILON &&
		runIsBalanced(node.first, axis) &&
		runIsBalanced(node.second, axis)
	);
}

/** Give every unit of the run at `node` an equal share; `inner` rebuilds the units themselves. */
function balanceRunNode(
	node: PaneNode,
	axis: SplitAxis,
	inner: (unit: PaneNode) => PaneNode,
): PaneNode {
	if (node.kind !== "split" || node.axis !== axis) return inner(node);
	const first = balanceRunNode(node.first, axis, inner);
	const second = balanceRunNode(node.second, axis, inner);
	const ratio = clampRatio(runUnits(node.first, axis) / runUnits(node, axis));
	return first === node.first && second === node.second && ratio === node.ratio
		? node
		: { ...node, ratio, first, second };
}

/** Rebuild the subtree at `path` through `update`; the same tree when nothing changes. */
function replaceAt(
	root: PaneNode,
	path: readonly number[],
	update: (node: PaneNode) => PaneNode,
): PaneNode {
	const rebuild = (node: PaneNode, depth: number): PaneNode => {
		if (depth === path.length) return update(node);
		if (node.kind !== "split") return node;
		const first = path[depth] === 0 ? rebuild(node.first, depth + 1) : node.first;
		const second = path[depth] === 1 ? rebuild(node.second, depth + 1) : node.second;
		return first === node.first && second === node.second ? node : { ...node, first, second };
	};
	return rebuild(root, 0);
}

/** Whether the run that holds the node at `path` on `axis` is balanced; no run counts as one. */
function balancedAt(root: PaneNode, path: readonly number[], axis: SplitAxis): boolean {
	const top = nodeAt(root, runTop(root, path, axis));
	return top === undefined || runIsBalanced(top, axis);
}

/** Balance the run that holds the node at `path` on `axis`. */
function balanceAt(root: PaneNode, path: readonly number[], axis: SplitAxis): PaneNode {
	return replaceAt(root, runTop(root, path, axis), (node) =>
		balanceRunNode(node, axis, (unit) => unit),
	);
}

/** Balance the run that holds the split at `path` (a divider's double click). */
export function balanceRun(root: PaneNode, path: readonly number[]): PaneNode {
	const node = nodeAt(root, path);
	return node?.kind === "split" ? balanceAt(root, path, node.axis) : root;
}

/** Balance every run in the tree. */
export function balanceAll(root: PaneNode): PaneNode {
	return root.kind === "pane" ? root : balanceRunNode(root, root.axis, balanceAll);
}

/** Rebuild the tree with every leaf passed through `update`; unchanged subtrees keep identity. */
function mapLeaves(root: PaneNode, update: (pane: PaneLeaf) => PaneNode): PaneNode {
	if (root.kind === "pane") return update(root);
	const first = mapLeaves(root.first, update);
	const second = mapLeaves(root.second, update);
	return first === root.first && second === root.second ? root : { ...root, first, second };
}

/**
 * Replace pane `target` with a split holding it and `added` (herdr `split_pane`); `leading` puts
 * `added` first. When the run the new split joins was balanced, it stays balanced (VS Code's
 * `splitSizing: auto`); otherwise only the target is halved. Focus is not moved.
 * @returns the new tree, or `undefined` when `target` is missing, `added` is already present
 * or the pane limit is reached.
 */
export function splitPane(
	root: PaneNode,
	target: PaneId,
	axis: SplitAxis,
	added: PaneLeaf,
	leading = false,
): PaneNode | undefined {
	const path = pathOf(root, target);
	if (path === undefined || findPane(root, added.id) !== undefined) return undefined;
	if (paneCount(root) >= MAX_PANES) return undefined;
	const wasBalanced = balancedAt(root, path, axis);
	const next = mapLeaves(root, (pane) =>
		pane.id === target ? (leading ? split(axis, added, pane) : split(axis, pane, added)) : pane,
	);
	return wasBalanced ? balanceAt(next, path, axis) : next;
}

/**
 * Remove a pane; a split left with one child is replaced by that child (herdr `remove_pane`).
 * A run that was balanced before stays balanced.
 * @returns the new tree, or `undefined` when the pane is missing or is the last one.
 */
export function removePane(root: PaneNode, id: PaneId): PaneNode | undefined {
	const path = pathOf(root, id);
	if (root.kind === "pane" || path === undefined) return undefined;
	const parentPath = path.slice(0, -1);
	const axis = (nodeAt(root, parentPath) as PaneSplit).axis;
	const wasBalanced = balancedAt(root, path, axis);
	const remove = (node: PaneNode): PaneNode | undefined => {
		if (node.kind === "pane") return node.id === id ? undefined : node;
		const first = remove(node.first);
		const second = remove(node.second);
		if (first === undefined) return second;
		if (second === undefined) return first;
		return first === node.first && second === node.second ? node : { ...node, first, second };
	};
	const next = remove(root) as PaneNode;
	return wasBalanced ? balanceAt(next, parentPath, axis) : next;
}

/**
 * Move pane `source` next to pane `target`, keeping its id and Session, so the moved pane is not
 * remounted (yuloop/dsh-web-split `movePaneBeside`, MIT, rewritten).
 * @returns the new tree, or `undefined` when either pane is missing or they are the same.
 */
export function movePane(
	root: PaneNode,
	source: PaneId,
	target: PaneId,
	side: Side,
): PaneNode | undefined {
	if (source === target) return undefined;
	const moving = findPane(root, source);
	const without = removePane(root, source);
	if (moving === undefined || without === undefined) return undefined;
	return splitPane(without, target, sideAxis(side), moving, sideLeads(side));
}

/**
 * Exchange the places of two panes; both keep their ids and Sessions.
 * @returns the new tree, or `undefined` when either pane is missing or they are the same.
 */
export function swapPanes(root: PaneNode, a: PaneId, b: PaneId): PaneNode | undefined {
	const first = findPane(root, a);
	const second = findPane(root, b);
	if (a === b || first === undefined || second === undefined) return undefined;
	return mapLeaves(root, (pane) => (pane.id === a ? second : pane.id === b ? first : pane));
}

/** Point a pane at another Session (or none); the same tree when the pane is missing. */
export function assignSession(
	root: PaneNode,
	id: PaneId,
	sessionId: SessionId | undefined,
): PaneNode {
	return mapLeaves(root, (pane) =>
		pane.id === id && pane.sessionId !== sessionId ? leaf(pane.id, sessionId) : pane,
	);
}

/** Set the ratio of the split at `path`; the same tree when the path is not a split. */
export function setRatioAt(root: PaneNode, path: readonly number[], ratio: number): PaneNode {
	const node = nodeAt(root, path);
	if (node?.kind !== "split") return root;
	const next = clampRatio(ratio);
	if (next === node.ratio) return root;
	const rebuild = (current: PaneNode, depth: number): PaneNode => {
		if (current.kind !== "split") return current;
		if (depth === path.length) return { ...current, ratio: next };
		return path[depth] === 0
			? { ...current, first: rebuild(current.first, depth + 1) }
			: { ...current, second: rebuild(current.second, depth + 1) };
	};
	return rebuild(root, 0);
}

/** Move focus; the pane left behind becomes the one-slot history. */
export function focusPane(state: LayoutState, id: PaneId): LayoutState {
	if (state.focus === id || findPane(state.root, id) === undefined) return state;
	return { ...state, focus: id, previous: state.focus };
}

/**
 * Close a pane (herdr `close_focused` / `close_pane`). Closing the focused pane moves focus to
 * the remembered pane when it still exists, else to the next pane in reading order, else the
 * previous one; the history is consumed. Closing a background pane keeps focus, and drops the
 * history only when it named the closed pane.
 * @returns the new state, or `undefined` when the pane is missing or is the last one.
 */
export function closePane(state: LayoutState, id: PaneId): LayoutState | undefined {
	const root = removePane(state.root, id);
	if (root === undefined) return undefined;
	if (state.focus !== id) {
		return {
			root,
			focus: state.focus,
			previous: state.previous === id ? undefined : state.previous,
		};
	}
	if (state.previous !== undefined && findPane(root, state.previous) !== undefined) {
		return { root, focus: state.previous, previous: undefined };
	}
	const order = panes(state.root);
	const index = order.findIndex((pane) => pane.id === id);
	const next = order[index + 1] ?? order[index - 1];
	return { root, focus: next?.id ?? (panes(root)[0]?.id as PaneId), previous: undefined };
}

/** The pane `delta` steps away from the focused one in reading order, wrapping around. */
export function cyclePane(state: LayoutState, delta: number): PaneId {
	const order = panes(state.root);
	const index = order.findIndex((pane) => pane.id === state.focus);
	const size = order.length;
	return (order[(((index + delta) % size) + size) % size] as PaneDescriptor).id;
}

/** Whether every pane id is unique and the focus names a pane. */
export function isValidState(state: LayoutState): boolean {
	const ids = panes(state.root).map((pane) => pane.id);
	return new Set(ids).size === ids.length && ids.includes(state.focus);
}
