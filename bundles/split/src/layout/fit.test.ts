import { describe, expect, it } from "bun:test";
import {
	bestSide,
	fitLayout,
	fitScore,
	MIN_PANE_WIDTH,
	minExtent,
	PANE_GAP,
	ratioBounds,
} from "./fit.ts";
import { layoutGeometry } from "./geometry.ts";
import { balanceAll, leaf, type PaneNode, panes, split } from "./tree.ts";

/** The overlay's surface at 1440x900 with the sidebar open. */
const laptop = { width: 1160, height: 900 };

const columns = (ids: readonly string[]): PaneNode => {
	const [first, ...rest] = ids.map((id) => leaf(id) as PaneNode);
	return rest.reduce(
		(root, next, index) => split("row", root, next, (index + 1) / (index + 2)),
		first as PaneNode,
	);
};

describe("fitScore", () => {
	it("fits eight panes as four columns of two", () => {
		const grid = split("column", columns(["a", "b", "c", "d"]), columns(["e", "f", "g", "h"]));
		expect(fitScore(grid, laptop)).toBeGreaterThanOrEqual(1);
	});

	it("does not fit eight panes in one row", () => {
		expect(fitScore(columns(["a", "b", "c", "d", "e", "f", "g", "h"]), laptop)).toBeLessThan(1);
	});
});

describe("bestSide", () => {
	it("puts a new pane on the right while the cards still fit", () => {
		expect(bestSide(leaf("a"), "a", laptop)).toBe("right");
		expect(bestSide(columns(["a", "b", "c"]), "c", laptop)).toBe("right");
	});

	it("goes below once another column would not fit", () => {
		expect(bestSide(columns(["a", "b", "c", "d"]), "d", laptop)).toBe("bottom");
		expect(bestSide(leaf("a"), "a", { width: 500, height: 900 })).toBe("bottom");
	});

	it("picks the roomier side when neither fits", () => {
		expect(bestSide(leaf("a"), "a", { width: 500, height: 200 })).toBe("right");
		expect(bestSide(leaf("a"), "a", { width: 400, height: 300 })).toBe("bottom");
	});
});

describe("ratioBounds", () => {
	const card = MIN_PANE_WIDTH + PANE_GAP;

	it("adds the needs of a run and takes the larger need across it", () => {
		expect(minExtent(columns(["a", "b", "c"]), "row")).toBe(3 * card);
		expect(minExtent(split("column", leaf("a"), columns(["b", "c"])), "row")).toBe(2 * card);
	});

	it("keeps every card on both sides at its minimum width", () => {
		const node = split("row", columns(["a", "b"]), leaf("c"));
		const bounds = ratioBounds(node, 1154);
		expect(bounds?.[0]).toBeCloseTo((2 * card + 1) / 1154);
		expect(bounds?.[1]).toBeCloseTo(1 - (card + 1) / 1154);
	});

	it("gives no bounds when the split is already too small", () => {
		expect(ratioBounds(split("row", leaf("a"), leaf("b")), 400)).toBeUndefined();
	});
});

describe("fitLayout", () => {
	// Three panes in the bottom-right quarter, as a "new conversation on the right" drop left them
	// at 1440x900: even shares cannot show them, a narrower left column can.
	const squeezed = split(
		"row",
		leaf("gamma"),
		split("column", leaf("beta"), split("row", columns(["alpha", "new"]), leaf("fake"), 2 / 3)),
	);

	it("moves dividers so that every card fits where even shares cannot", () => {
		expect(fitScore(squeezed, laptop)).toBeLessThan(1);
		expect(fitScore(balanceAll(squeezed), laptop)).toBeLessThan(1);
		const fitted = fitLayout(squeezed, laptop);
		if (fitted === undefined) throw new Error("expected a fit");
		expect(fitScore(fitted, laptop)).toBeGreaterThanOrEqual(1);
		expect(panes(fitted).map((pane) => pane.id)).toEqual(["gamma", "beta", "alpha", "new", "fake"]);
	});

	it("shares the room it makes in proportion to need instead of stopping at the minimum", () => {
		// A pane split in two on the left of a half-and-half split, about 1000 px wide.
		const surface = { width: 994, height: 800 };
		const crowded = split("row", columns(["a", "b"]), leaf("c"));
		expect(fitScore(crowded, surface)).toBeLessThan(1);
		const fitted = fitLayout(crowded, surface);
		if (fitted === undefined) throw new Error("expected a fit");
		const widths = layoutGeometry(
			fitted,
			surface.width - PANE_GAP,
			surface.height - PANE_GAP,
		).panes.map((pane) => pane.width - PANE_GAP);
		expect(Math.min(...widths)).toBeGreaterThanOrEqual(MIN_PANE_WIDTH + 30);
	});

	it("returns a layout that already fits unchanged", () => {
		const grid = split("column", columns(["a", "b", "c", "d"]), columns(["e", "f", "g", "h"]));
		expect(fitLayout(grid, laptop)).toBe(grid);
	});

	it("gives up when no divider positions fit", () => {
		expect(fitLayout(columns(["a", "b", "c", "d", "e"]), laptop)).toBeUndefined();
	});
});
