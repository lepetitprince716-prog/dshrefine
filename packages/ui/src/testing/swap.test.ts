import { afterAll, describe, expect, test } from "bun:test";
import { installDom, isDomInstalled, uninstallDom } from "./dom.ts";

afterAll(() => uninstallDom());

describe("shared DOM window", () => {
	test("release restores the runtime globals and keeps the window for the next install", () => {
		const runtimeFetch = globalThis.fetch;
		const runtimeSetTimeout = globalThis.setTimeout;

		installDom();
		expect(isDomInstalled()).toBe(true);
		const firstDocument = globalThis.document;
		const firstBody = firstDocument.body;
		firstBody.append(firstDocument.createElement("p"));
		expect(globalThis.fetch).not.toBe(runtimeFetch);

		uninstallDom();
		expect(isDomInstalled()).toBe(false);
		expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined");
		expect(globalThis.fetch).toBe(runtimeFetch);
		expect(globalThis.setTimeout).toBe(runtimeSetTimeout);

		installDom();
		expect(globalThis.document).toBe(firstDocument);
		expect(globalThis.document.body).toBe(firstBody);
		expect(firstBody.childElementCount).toBe(0);
	});

	test("install and release are idempotent", () => {
		installDom();
		installDom();
		const document = globalThis.document;
		uninstallDom();
		uninstallDom();
		expect(isDomInstalled()).toBe(false);
		installDom();
		expect(globalThis.document).toBe(document);
	});

	test("timers of the shared window keep running after a release and reinstall", async () => {
		installDom();
		const windowSetTimeout = globalThis.setTimeout;
		uninstallDom();
		installDom();
		const fired = await new Promise<boolean>((resolve) => {
			windowSetTimeout(() => resolve(true), 1);
		});
		expect(fired).toBe(true);
	});
});
