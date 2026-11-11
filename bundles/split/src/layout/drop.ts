// Drop zones of one pane during a drag: the centre box replaces or swaps, any other point splits
// towards the nearest edge. The hit test follows lehhair/dsh-split-panes `PaneDropOverlay.tsx`
// (BSD-3-Clause, rewritten): the centre box spans 40% of each axis, and the remaining area goes to
// the edge with the smallest normalised distance.
import type { Side } from "./tree.ts";

export type DropZone = Side | "center";

/** Half the centre box, as a share of the pane on each axis. */
export const CENTER_HALF = 0.2;

/**
 * Resolve the zone under a point inside a pane.
 * @param x - pointer x relative to the pane's left edge.
 * @param y - pointer y relative to the pane's top edge.
 * @param width - pane width.
 * @param height - pane height.
 * @param center - whether the centre box is a target; when not, the nearest edge always wins.
 * @returns the zone, or `null` outside the pane or for an empty pane.
 */
export function resolveDropZone(
	x: number,
	y: number,
	width: number,
	height: number,
	center = true,
): DropZone | null {
	if (width <= 0 || height <= 0) return null;
	const u = x / width;
	const v = y / height;
	if (u < 0 || u > 1 || v < 0 || v > 1) return null;
	if (center && Math.abs(u - 0.5) < CENTER_HALF && Math.abs(v - 0.5) < CENTER_HALF) return "center";
	const distances: readonly (readonly [Side, number])[] = [
		["left", u],
		["right", 1 - u],
		["top", v],
		["bottom", 1 - v],
	];
	return distances.reduce((best, next) => (next[1] < best[1] ? next : best))[0];
}
