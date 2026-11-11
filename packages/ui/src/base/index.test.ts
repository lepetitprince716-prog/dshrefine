import { describe, expect, test } from "bun:test";
import * as base from "./index.ts";

const COMPONENTS = [
	"Button",
	"IconButton",
	"Chip",
	"StatusDot",
	"Kbd",
	"Divider",
	"Spinner",
	"Field",
	"TextInput",
	"TextArea",
	"Select",
	"Combobox",
	"Switch",
	"Checkbox",
	"SegmentedTabs",
	"Modal",
	"Popover",
	"Menu",
	"Tooltip",
	"Toast",
	"Disclosure",
	"List",
	"Tree",
	"EmptyState",
	"ErrorBanner",
	"Skeleton",
	"ScrollArea",
	"OverlayLayer",
	"OverlayProvider",
] as const;

describe("base entry point", () => {
	test("exports every DESIGN section 3 base, form and container component plus the overlay", () => {
		const exported = base as Record<string, unknown>;
		const missing = COMPONENTS.filter((name) => exported[name] === undefined);
		expect(missing).toEqual([]);
	});

	test("keeps the overlay store contract the coordinator compiles against", () => {
		const store = base.createOverlayStore();
		for (const member of [
			"open",
			"toast",
			"update",
			"close",
			"closeAll",
			"getSnapshot",
			"subscribe",
		] as const) {
			expect(typeof store[member]).toBe("function");
		}
		expect(typeof base.useOverlay).toBe("function");
		expect(typeof base.useOverlayLayer).toBe("function");
	});
});
