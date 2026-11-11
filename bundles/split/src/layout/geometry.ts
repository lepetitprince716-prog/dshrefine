// Pixel geometry of a split tree: one rectangle per pane and one divider per split, computed in
// integer pixels so neighbouring panes tile without gaps (the first child's size is rounded and
// the second gets the rest, as herdr `split_rect` does).
import type { PaneId, PaneNode, SplitAxis } from "./tree.ts";

export interface Rect {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface PaneBox extends Rect {
	readonly id: PaneId;
}

/** A divider sits on the boundary between a split's children; `area` is the split's own box. */
export interface DividerBox {
	readonly path: readonly number[];
	readonly axis: SplitAxis;
	readonly ratio: number;
	/** Offset of the boundary from the area's start along the axis. */
	readonly offset: number;
	readonly area: Rect;
}

export interface Geometry {
	readonly panes: readonly PaneBox[];
	readonly dividers: readonly DividerBox[];
}

export function layoutGeometry(root: PaneNode, width: number, height: number): Geometry {
	const panes: PaneBox[] = [];
	const dividers: DividerBox[] = [];
	const walk = (node: PaneNode, path: readonly number[], area: Rect): void => {
		if (node.kind === "pane") {
			panes.push({ id: node.id, ...area });
			return;
		}
		const along = node.axis === "row" ? area.width : area.height;
		const offset = Math.round(along * node.ratio);
		dividers.push({ path, axis: node.axis, ratio: node.ratio, offset, area });
		if (node.axis === "row") {
			walk(node.first, [...path, 0], { ...area, width: offset });
			walk(node.second, [...path, 1], {
				...area,
				left: area.left + offset,
				width: area.width - offset,
			});
			return;
		}
		walk(node.first, [...path, 0], { ...area, height: offset });
		walk(node.second, [...path, 1], {
			...area,
			top: area.top + offset,
			height: area.height - offset,
		});
	};
	walk(root, [], {
		left: 0,
		top: 0,
		width: Math.max(0, Math.round(width)),
		height: Math.max(0, Math.round(height)),
	});
	return { panes, dividers };
}

/** Whether every pane fits the minimum size; when not, the overlay shows one pane at a time. */
export function fitsPanes(geometry: Geometry, minWidth: number, minHeight: number): boolean {
	return geometry.panes.every((pane) => pane.width >= minWidth && pane.height >= minHeight);
}

/**
 * The ratio a pointer position gives a divider, keeping the grab offset so the divider does not
 * jump on pointer-down (herdr `mouse.rs`).
 */
export function ratioFromPointer(divider: DividerBox, pointer: number, grabOffset: number): number {
	const start = divider.axis === "row" ? divider.area.left : divider.area.top;
	const size = divider.axis === "row" ? divider.area.width : divider.area.height;
	if (size <= 0) return divider.ratio;
	return (pointer - grabOffset - start) / size;
}
