import { installDom, uninstallDom } from "./dom.ts";

export { DOM_URL, isDomInstalled } from "./dom.ts";

let testingLibraryLoaded = false;

/**
 * Load Testing Library after happy-dom is installed. react-dom (CommonJS) decides at load time
 * whether a DOM exists, and Bun evaluates CommonJS dependencies of a test file before the body
 * of an ESM side-effect import, so a static `import … from "@testing-library/react"` would load
 * react-dom first. DOM test files therefore start with `import "@refine/ui/testing/register";` and
 * obtain Testing Library through this function. Components must not import react-dom statically.
 * The register module runs once per process, so a later DOM test file (after an earlier file
 * released the DOM) installs the shared window again here.
 */
export async function loadTestingLibrary(): Promise<typeof import("@testing-library/react")> {
	installDom();
	const library = await import("@testing-library/react");
	testingLibraryLoaded = true;
	return library;
}

/**
 * After the calling test file, unmount what Testing Library rendered and take the DOM globals
 * off the global scope so they never leak into non-DOM test files that share the Bun process.
 * The shared window itself stays open (see `./dom.ts`). Pass `afterAll` from `bun:test`.
 */
export function releaseDomAfterAll(afterAll: (fn: () => Promise<void>) => void): void {
	afterAll(async () => {
		if (testingLibraryLoaded) (await import("@testing-library/react")).cleanup();
		uninstallDom();
	});
}
