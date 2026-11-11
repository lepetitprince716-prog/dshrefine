import { describe, expect, it } from "bun:test";
import { resolveDropZone } from "./drop.ts";

describe("resolveDropZone", () => {
	it("returns the centre inside the middle 40% box", () => {
		expect(resolveDropZone(50, 50, 100, 100)).toBe("center");
		expect(resolveDropZone(31, 69, 100, 100)).toBe("center");
	});

	it("returns the nearest edge outside the centre box", () => {
		expect(resolveDropZone(10, 50, 100, 100)).toBe("left");
		expect(resolveDropZone(90, 50, 100, 100)).toBe("right");
		expect(resolveDropZone(50, 5, 100, 100)).toBe("top");
		expect(resolveDropZone(50, 95, 100, 100)).toBe("bottom");
	});

	it("compares edges by normalised distance in a wide pane", () => {
		expect(resolveDropZone(100, 30, 1000, 100)).toBe("left");
		expect(resolveDropZone(400, 10, 1000, 100)).toBe("top");
	});

	it("returns the nearest edge everywhere when the centre is not a target", () => {
		expect(resolveDropZone(50, 50, 100, 100, false)).toBe("left");
		expect(resolveDropZone(55, 40, 100, 100, false)).toBe("top");
		expect(resolveDropZone(60, 50, 100, 100, false)).toBe("right");
	});

	it("returns nothing outside the pane or for an empty pane", () => {
		expect(resolveDropZone(-1, 50, 100, 100)).toBeNull();
		expect(resolveDropZone(50, 101, 100, 100)).toBeNull();
		expect(resolveDropZone(0, 0, 0, 100)).toBeNull();
	});
});
