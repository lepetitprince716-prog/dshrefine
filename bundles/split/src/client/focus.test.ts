import { describe, expect, test } from "bun:test";
import { paneFocusAction, trackKeyboardNavigation } from "./focus.ts";

/** A document that only records its keydown listener. */
function fakeDocument(): { doc: Document; press(key: string, timeStamp: number): void } {
	let listener: ((event: KeyboardEvent) => void) | undefined;
	const doc = {
		addEventListener(_type: string, fn: (event: KeyboardEvent) => void) {
			listener = fn;
		},
		removeEventListener() {
			listener = undefined;
		},
	} as unknown as Document;
	return {
		doc,
		press(key, timeStamp) {
			listener?.({ key, timeStamp } as KeyboardEvent);
		},
	};
}

describe("paneFocusAction", () => {
	test("focus in the active pane changes nothing", () => {
		expect(paneFocusAction(true, 10)).toBe("none");
	});

	test("focus moved by Tab activates the pane it lands in", () => {
		const { doc, press } = fakeDocument();
		const stop = trackKeyboardNavigation(doc);
		press("Tab", 1000);
		expect(paneFocusAction(false, 1040)).toBe("activate");
		stop();
	});

	test("focus moved by code sends the keyboard back to the active pane", () => {
		const { doc, press } = fakeDocument();
		const stop = trackKeyboardNavigation(doc);
		press("Tab", 1000);
		press("a", 5000);
		expect(paneFocusAction(false, 5010)).toBe("refocus");
		stop();
	});
});
