import { describe, expect, it } from "bun:test";
import { fitsPanes, layoutGeometry, ratioFromPointer } from "./geometry.ts";
import { leaf, split } from "./tree.ts";

describe("layoutGeometry", () => {
	it("measures a single pane as the whole area", () => {
		expect(layoutGeometry(leaf("a"), 800, 600)).toEqual({
			panes: [{ id: "a", left: 0, top: 0, width: 800, height: 600 }],
			dividers: [],
		});
	});

	it("splits a row by share and stacks a column by share", () => {
		const row = layoutGeometry(split("row", leaf("a"), leaf("b"), 0.3), 1000, 500);
		expect(row.panes).toEqual([
			{ id: "a", left: 0, top: 0, width: 300, height: 500 },
			{ id: "b", left: 300, top: 0, width: 700, height: 500 },
		]);
		const column = layoutGeometry(split("column", leaf("a"), leaf("b"), 0.25), 400, 800);
		expect(column.panes.map((pane) => [pane.top, pane.height])).toEqual([
			[0, 200],
			[200, 600],
		]);
	});

	it("tiles odd sizes without gaps: the first child is rounded, the second gets the rest", () => {
		const geometry = layoutGeometry(
			split("row", leaf("a"), split("row", leaf("b"), leaf("c")), 1 / 3),
			1001,
			10,
		);
		const [a, b, c] = geometry.panes;
		if (a === undefined || b === undefined || c === undefined) throw new Error("missing pane");
		expect(a.width).toBe(334);
		expect(b.left).toBe(334);
		expect(b.left + b.width).toBe(c.left);
		expect(c.left + c.width).toBe(1001);
	});

	it("places one divider per split on the boundary, inside the split's own area", () => {
		const geometry = layoutGeometry(
			split("row", leaf("a"), split("column", leaf("b"), leaf("c"), 0.25), 0.5),
			800,
			400,
		);
		expect(geometry.dividers).toEqual([
			{
				path: [],
				axis: "row",
				ratio: 0.5,
				offset: 400,
				area: { left: 0, top: 0, width: 800, height: 400 },
			},
			{
				path: [1],
				axis: "column",
				ratio: 0.25,
				offset: 100,
				area: { left: 400, top: 0, width: 400, height: 400 },
			},
		]);
	});
});

describe("fitsPanes", () => {
	it("reports whether every pane meets the minimum size", () => {
		const geometry = layoutGeometry(split("row", leaf("a"), leaf("b")), 700, 600);
		expect(fitsPanes(geometry, 320, 240)).toBe(true);
		expect(fitsPanes(geometry, 360, 240)).toBe(false);
		expect(fitsPanes(geometry, 320, 601)).toBe(false);
	});
});

describe("ratioFromPointer", () => {
	const divider = layoutGeometry(
		split("row", leaf("a"), split("row", leaf("b"), leaf("c"))),
		1000,
		100,
	).dividers[1];

	it("measures the pointer inside the split's own area and keeps the grab offset", () => {
		if (divider === undefined) throw new Error("missing divider");
		expect(divider.area.left).toBe(500);
		expect(ratioFromPointer(divider, 750, 0)).toBe(0.5);
		expect(ratioFromPointer(divider, 850, 0)).toBe(0.7);
		expect(ratioFromPointer(divider, 853, 3)).toBe(0.7);
	});

	it("keeps the current ratio for an empty area", () => {
		const empty = layoutGeometry(split("row", leaf("a"), leaf("b"), 0.4), 0, 0).dividers[0];
		if (empty === undefined) throw new Error("missing divider");
		expect(ratioFromPointer(empty, 10, 0)).toBe(0.4);
	});
});
