import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { ICON_NAMES, Icon, type IconName } from "./Icon.tsx";

const { cleanup, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

// DESIGN.md section 3, in order.
const REQUIRED: readonly IconName[] = [
	"branch",
	"folder",
	"folder-open",
	"plus",
	"close",
	"check",
	"check-circle",
	"circle",
	"circle-dot",
	"play",
	"pause",
	"trash",
	"edit",
	"comment",
	"comment-plus",
	"diff",
	"file",
	"file-plus",
	"file-minus",
	"chevron-right",
	"chevron-down",
	"more",
	"refresh",
	"external",
	"git-pr",
	"git-commit",
	"git-merge",
	"spec",
	"plan",
	"shelf",
	"warning",
	"info",
	"send",
	"search",
	"filter",
	"eye",
	"copy",
	"sparkle",
];

describe("Icon", () => {
	test("the set is exactly the DESIGN list", () => {
		expect([...ICON_NAMES]).toEqual([...REQUIRED]);
	});

	test("decorative icons are hidden from assistive technology", () => {
		const view = render(<Icon name="branch" />);
		const svg = view.container.querySelector("svg");
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
		expect(svg?.getAttribute("role")).toBeNull();
		expect(svg?.getAttribute("focusable")).toBe("false");
		expect(view.queryByRole("img")).toBeNull();
	});

	test("a label makes the icon an image with that name", () => {
		const view = render(<Icon name="warning" label="Warning" size={20} />);
		const img = view.getByRole("img", { name: "Warning" });
		expect(img.getAttribute("aria-hidden")).toBeNull();
		expect(img.getAttribute("width")).toBe("20");
		expect(img.getAttribute("viewBox")).toBe("0 0 16 16");
	});

	test("every icon draws in currentColor on a 1.5px stroke and stays inside the grid", () => {
		for (const name of ICON_NAMES) {
			const view = render(<Icon name={name} />);
			const svg = view.container.querySelector("svg");
			expect(svg?.getAttribute("stroke")).toBe("currentColor");
			expect(svg?.getAttribute("stroke-width")).toBe("1.5");
			expect(svg?.getAttribute("fill")).toBe("none");
			expect(svg?.getAttribute("width")).toBe("16");
			const shapes = svg?.querySelectorAll("path, circle, rect") ?? [];
			expect(shapes.length).toBeGreaterThan(0);
			for (const shape of shapes) {
				const fill = shape.getAttribute("fill");
				if (fill !== null) expect(fill).toBe("currentColor");
				const numbers = (shape.getAttribute("d") ?? "").match(/-?\d*\.?\d+/g) ?? [];
				for (const value of numbers) expect(Math.abs(Number(value))).toBeLessThanOrEqual(16);
			}
			cleanup();
		}
	});
});
