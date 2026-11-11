// The sidebar's New session button is the host's: while a split is open the bundle takes its
// click over so the conversation is planned on a home surface, and outside a split it must leave
// the shipped click alone. These tests pin both directions from the document-level listener.
import "@refine/ui/testing/register";
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { loadTestingLibrary, releaseDomAfterAll } from "@refine/ui/testing";
import { trackHostNewSession } from "./drag.ts";

// A later DOM test file installs the shared window again: the register module runs once.
await loadTestingLibrary();
releaseDomAfterAll(afterAll);

/** Host shapes the selectors match (`_sidebarCol` wrapper, `_newSession` button). */
function mountHostButton(): { button: HTMLButtonElement; hostClicks: () => number } {
	const sidebar = document.createElement("div");
	sidebar.className = "SidebarRoot_sidebarCol__a1";
	const button = document.createElement("button");
	button.className = "SidebarRoot_newSession__b2";
	button.type = "button";
	sidebar.append(button);
	document.body.append(sidebar);
	let clicks = 0;
	button.addEventListener("click", () => {
		clicks += 1;
	});
	return { button, hostClicks: () => clicks };
}

afterEach(() => {
	for (const node of document.body.children) node.remove();
});

describe("trackHostNewSession", () => {
	it("takes a plain click over while the split is open", () => {
		const { button, hostClicks } = mountHostButton();
		let taken = 0;
		const dispose = trackHostNewSession(document, () => {
			taken += 1;
			return true;
		});
		button.click();
		dispose();
		expect(taken).toBe(1);
		expect(hostClicks()).toBe(0);
	});

	it("leaves the shipped click alone when no split is open", () => {
		const { button, hostClicks } = mountHostButton();
		const dispose = trackHostNewSession(document, () => false);
		button.click();
		dispose();
		expect(hostClicks()).toBe(1);
	});

	it("passes modified clicks through to the host", () => {
		const { button, hostClicks } = mountHostButton();
		let taken = 0;
		const dispose = trackHostNewSession(document, () => {
			taken += 1;
			return true;
		});
		button.dispatchEvent(new MouseEvent("click", { button: 0, metaKey: true, bubbles: true }));
		dispose();
		expect(taken).toBe(0);
		expect(hostClicks()).toBe(1);
	});

	it("ignores clicks outside the button", () => {
		mountHostButton();
		let taken = 0;
		const dispose = trackHostNewSession(document, () => {
			taken += 1;
			return true;
		});
		document.querySelector("button")?.parentElement?.click();
		dispose();
		expect(taken).toBe(0);
	});
});
