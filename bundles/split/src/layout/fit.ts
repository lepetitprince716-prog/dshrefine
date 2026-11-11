// Whether a layout's pane cards fit a surface, and where a new pane beside another fits best.
// Panes are cards inset by half a gap within their box, so a card is its box less one gap.
import { layoutGeometry } from "./geometry.ts";
import {
	leaf,
	type PaneId,
	type PaneNode,
	type PaneSplit,
	type SplitAxis,
	splitPane,
} from "./tree.ts";

/** Smallest usable pane card, in px; below it the overlay shows one pane at a time. */
export const MIN_PANE_WIDTH = 280;
export const MIN_PANE_HEIGHT = 200;
/** Space between panes; 0 tiles them into columns divided by a hairline. */
export const PANE_GAP = 0;

export interface Surface {
	readonly width: number;
	readonly height: number;
}

/**
 * The smallest card of a layout as a share of the minimum card size: 1 or more means every
 * card fits, and a larger value means more room.
 */
export function fitScore(root: PaneNode, surface: Surface): number {
	const geometry = layoutGeometry(
		root,
		Math.max(0, surface.width - PANE_GAP),
		Math.max(0, surface.height - PANE_GAP),
	);
	return Math.min(
		...geometry.panes.map((pane) =>
			Math.min(
				(pane.width - PANE_GAP) / MIN_PANE_WIDTH,
				(pane.height - PANE_GAP) / MIN_PANE_HEIGHT,
			),
		),
	);
}

/** The extent a subtree needs along an axis so that each of its cards keeps its minimum size. */
export function minExtent(node: PaneNode, axis: SplitAxis): number {
	if (node.kind === "pane") return (axis === "row" ? MIN_PANE_WIDTH : MIN_PANE_HEIGHT) + PANE_GAP;
	const first = minExtent(node.first, axis);
	const second = minExtent(node.second, axis);
	return node.axis === axis ? first + second : Math.max(first, second);
}

/**
 * The ratios a split's divider may take so that no card on either side drops below its minimum
 * size, with a pixel to spare for rounding.
 * @param size - the split's extent along its axis, in px.
 * @returns the bounds, or `undefined` when the split is already too small for both sides.
 */
export function ratioBounds(node: PaneSplit, size: number): readonly [number, number] | undefined {
	if (size <= 0) return undefined;
	const low = (minExtent(node.first, node.axis) + 1) / size;
	const high = 1 - (minExtent(node.second, node.axis) + 1) / size;
	return low <= high ? [low, high] : undefined;
}

/**
 * The layout with its dividers moved so that every card keeps its minimum size, as VS Code's grid
 * takes room from neighbours to give a view its minimum. A divider already within its bounds
 * stays put, so a layout that fits comes back unchanged (the same object). A divider that has to
 * move shares its split in proportion to what each side needs, rather than stopping at the bound,
 * so the cards it makes room for are not left a few pixels from collapsing to one pane.
 * Works in whole pixels, as `layoutGeometry` does, so tight fits do not fail on rounding.
 * @returns the fitted layout, or `undefined` when no divider positions fit the surface.
 */
export function fitLayout(root: PaneNode, surface: Surface): PaneNode | undefined {
	const fit = (node: PaneNode, width: number, height: number): PaneNode | undefined => {
		if (node.kind === "pane") {
			const fits = width >= MIN_PANE_WIDTH + PANE_GAP && height >= MIN_PANE_HEIGHT + PANE_GAP;
			return fits ? node : undefined;
		}
		const size = node.axis === "row" ? width : height;
		const low = minExtent(node.first, node.axis);
		const high = size - minExtent(node.second, node.axis);
		if (low > high) return undefined;
		const current = Math.round(size * node.ratio);
		const inBounds = current >= low && current <= high;
		const share = Math.round((size * low) / (low + size - high));
		const offset = inBounds ? current : Math.min(high, Math.max(low, share));
		const ratio = offset === current ? node.ratio : offset / size;
		const first =
			node.axis === "row" ? fit(node.first, offset, height) : fit(node.first, width, offset);
		const second =
			node.axis === "row"
				? fit(node.second, width - offset, height)
				: fit(node.second, width, height - offset);
		if (first === undefined || second === undefined) return undefined;
		if (ratio === node.ratio && first === node.first && second === node.second) return node;
		return { ...node, ratio, first, second };
	};
	return fit(
		root,
		Math.max(0, Math.round(surface.width - PANE_GAP)),
		Math.max(0, Math.round(surface.height - PANE_GAP)),
	);
}

const PROBE_ID = "\u0000probe";

/**
 * The side of `target` a new pane should take. Conversations read best side by side, so right
 * wins whenever every card can still fit; then below; when neither can, the side that leaves the
 * smallest card larger.
 */
export function bestSide(root: PaneNode, target: PaneId, surface: Surface): "right" | "bottom" {
	const right = splitPane(root, target, "row", leaf(PROBE_ID));
	const below = splitPane(root, target, "column", leaf(PROBE_ID));
	if (right !== undefined && fitLayout(right, surface) !== undefined) return "right";
	if (below !== undefined && fitLayout(below, surface) !== undefined) return "bottom";
	const rightScore = right === undefined ? Number.NEGATIVE_INFINITY : fitScore(right, surface);
	const belowScore = below === undefined ? Number.NEGATIVE_INFINITY : fitScore(below, surface);
	return belowScore > rightScore ? "bottom" : "right";
}
