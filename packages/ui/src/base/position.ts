import type { OverlayPlacement } from "./overlay.ts";

export interface LayerRect {
	readonly top: number;
	readonly left: number;
	readonly right: number;
	readonly bottom: number;
	readonly width: number;
	readonly height: number;
}

export interface LayerSize {
	readonly width: number;
	readonly height: number;
}

export interface LayerPosition {
	readonly top: number;
	readonly left: number;
	/** The placement actually used after flipping. */
	readonly placement: OverlayPlacement;
}

/** Distance between an anchor and its layer, in px. */
export const LAYER_GAP = 4;
/** Minimum distance between a layer and the viewport edge, in px. */
export const VIEWPORT_MARGIN = 8;

const OPPOSITE = { bottom: "top", top: "bottom", right: "left", left: "right" } as const;
type Side = keyof typeof OPPOSITE;

function clamp(value: number, size: number, limit: number): number {
	const max = limit - size - VIEWPORT_MARGIN;
	return max < VIEWPORT_MARGIN ? VIEWPORT_MARGIN : Math.min(Math.max(value, VIEWPORT_MARGIN), max);
}

function mainStart(side: Side, anchor: LayerRect, layer: LayerSize): number {
	switch (side) {
		case "bottom":
			return anchor.bottom + LAYER_GAP;
		case "top":
			return anchor.top - LAYER_GAP - layer.height;
		case "right":
			return anchor.right + LAYER_GAP;
		case "left":
			return anchor.left - LAYER_GAP - layer.width;
	}
}

function fits(side: Side, start: number, layer: LayerSize, viewport: LayerSize): boolean {
	if (side === "bottom") return start + layer.height <= viewport.height - VIEWPORT_MARGIN;
	if (side === "right") return start + layer.width <= viewport.width - VIEWPORT_MARGIN;
	return start >= VIEWPORT_MARGIN;
}

function room(side: Side, anchor: LayerRect, viewport: LayerSize): number {
	if (side === "bottom") return viewport.height - anchor.bottom;
	if (side === "top") return anchor.top;
	if (side === "right") return viewport.width - anchor.right;
	return anchor.left;
}

/**
 * Viewport position of an anchored layer. The layer flips to the opposite side when it would
 * overflow and the other side has more room, then both axes are clamped into the viewport.
 */
export function computeLayerPosition(
	anchor: LayerRect,
	layer: LayerSize,
	viewport: LayerSize,
	placement: OverlayPlacement,
): LayerPosition {
	const [preferred, align] = placement.split("-") as [Side, "start" | "end"];
	let side: Side = preferred;
	if (!fits(side, mainStart(side, anchor, layer), layer, viewport)) {
		const other = OPPOSITE[side];
		const otherFits = fits(other, mainStart(other, anchor, layer), layer, viewport);
		if (otherFits || room(other, anchor, viewport) > room(side, anchor, viewport)) side = other;
	}
	const vertical = side === "bottom" || side === "top";
	const main = mainStart(side, anchor, layer);
	const cross = vertical
		? align === "start"
			? anchor.left
			: anchor.right - layer.width
		: align === "start"
			? anchor.top
			: anchor.bottom - layer.height;
	const top = vertical
		? clamp(main, layer.height, viewport.height)
		: clamp(cross, layer.height, viewport.height);
	const left = vertical
		? clamp(cross, layer.width, viewport.width)
		: clamp(main, layer.width, viewport.width);
	return { top, left, placement: `${side}-${align}` as OverlayPlacement };
}
