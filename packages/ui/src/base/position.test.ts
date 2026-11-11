import { describe, expect, test } from "bun:test";
import { computeLayerPosition, LAYER_GAP, type LayerRect, VIEWPORT_MARGIN } from "./position.ts";

const VIEWPORT = { width: 1000, height: 800 };

function rect(left: number, top: number, width: number, height: number): LayerRect {
	return { left, top, width, height, right: left + width, bottom: top + height };
}

describe("computeLayerPosition", () => {
	test("bottom-start sits below the anchor, aligned to its left edge", () => {
		const position = computeLayerPosition(
			rect(100, 100, 80, 24),
			{ width: 200, height: 150 },
			VIEWPORT,
			"bottom-start",
		);
		expect(position).toEqual({ top: 124 + LAYER_GAP, left: 100, placement: "bottom-start" });
	});

	test("bottom-end aligns the layer's right edge with the anchor's right edge", () => {
		const position = computeLayerPosition(
			rect(500, 100, 80, 24),
			{ width: 200, height: 150 },
			VIEWPORT,
			"bottom-end",
		);
		expect(position.left).toBe(580 - 200);
		expect(position.placement).toBe("bottom-end");
	});

	test("flips to the top when the layer would overflow the bottom edge", () => {
		const position = computeLayerPosition(
			rect(100, 700, 80, 24),
			{ width: 200, height: 150 },
			VIEWPORT,
			"bottom-start",
		);
		expect(position).toEqual({ top: 700 - LAYER_GAP - 150, left: 100, placement: "top-start" });
	});

	test("flips to the bottom when top placement would overflow the top edge", () => {
		const position = computeLayerPosition(
			rect(100, 20, 80, 24),
			{ width: 200, height: 150 },
			VIEWPORT,
			"top-start",
		);
		expect(position.placement).toBe("bottom-start");
		expect(position.top).toBe(44 + LAYER_GAP);
	});

	test("keeps the preferred side when neither side fits but it has more room, then clamps", () => {
		const position = computeLayerPosition(
			rect(100, 300, 80, 24),
			{ width: 200, height: 700 },
			VIEWPORT,
			"bottom-start",
		);
		expect(position.placement).toBe("bottom-start");
		expect(position.top).toBe(800 - 700 - VIEWPORT_MARGIN);
	});

	test("clamps horizontally into the viewport", () => {
		const position = computeLayerPosition(
			rect(950, 100, 40, 24),
			{ width: 200, height: 100 },
			VIEWPORT,
			"bottom-start",
		);
		expect(position.left).toBe(1000 - 200 - VIEWPORT_MARGIN);
	});

	test("right-start flips to left-start near the right edge", () => {
		const position = computeLayerPosition(
			rect(900, 100, 60, 24),
			{ width: 200, height: 100 },
			VIEWPORT,
			"right-start",
		);
		expect(position).toEqual({ top: 100, left: 900 - LAYER_GAP - 200, placement: "left-start" });
	});

	test("a layer wider than the viewport pins to the margin", () => {
		const position = computeLayerPosition(
			rect(10, 10, 40, 24),
			{ width: 2000, height: 100 },
			VIEWPORT,
			"bottom-start",
		);
		expect(position.left).toBe(VIEWPORT_MARGIN);
	});
});
