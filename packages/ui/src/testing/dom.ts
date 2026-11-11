import { GlobalRegistrator } from "@happy-dom/global-registrator";

// One happy-dom window per test process, swapped in and out of the global scope.
//
// Bun runs every test file of a `bun test` invocation in one process with one module registry.
// react-dom, its scheduler and Testing Library are evaluated once, by the first DOM test file,
// and keep references to that file's window (timers, `document.body`). Closing the window after
// a file (what `GlobalRegistrator.unregister` does) leaves those modules bound to a destroyed
// window, so a later DOM file sees updates that never render and change events that never
// arrive. This module therefore registers happy-dom once and never unregisters, closes or
// aborts it. It records which global properties the registration changed; releasing restores
// the originals so non-DOM files see the plain runtime, and installing again re-applies the same
// window's properties. Pending window tasks are left alone on purpose: aborting them would leave
// React's scheduler waiting for a callback that never runs.

export const DOM_URL = "http://127.0.0.1/";

interface Swap {
	readonly key: PropertyKey;
	readonly original: PropertyDescriptor | undefined;
	readonly dom: PropertyDescriptor;
}

let swaps: readonly Swap[] | null = null;
let installed = false;

function globalDescriptors(): Map<PropertyKey, PropertyDescriptor> {
	const descriptors = new Map<PropertyKey, PropertyDescriptor>();
	for (const key of Reflect.ownKeys(globalThis)) {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
		if (descriptor !== undefined) descriptors.set(key, descriptor);
	}
	return descriptors;
}

function sameDescriptor(a: PropertyDescriptor, b: PropertyDescriptor): boolean {
	return (
		a.value === b.value &&
		a.get === b.get &&
		a.set === b.set &&
		a.writable === b.writable &&
		a.enumerable === b.enumerable &&
		a.configurable === b.configurable
	);
}

function registerOnce(): readonly Swap[] {
	if (GlobalRegistrator.isRegistered) {
		throw new Error("happy-dom was registered outside @refine/ui/testing; use installDom() only");
	}
	const before = globalDescriptors();
	GlobalRegistrator.register({ url: DOM_URL });
	const changed: Swap[] = [];
	for (const [key, dom] of globalDescriptors()) {
		const original = before.get(key);
		if (original === undefined || !sameDescriptor(original, dom)) {
			changed.push({ key, original, dom });
		}
	}
	return changed;
}

/** True while the shared window is exposed on the global scope. */
export function isDomInstalled(): boolean {
	return installed;
}

/** Expose the shared window on the global scope, registering it on first use. Idempotent. */
export function installDom(): void {
	if (installed) return;
	if (swaps === null) {
		swaps = registerOnce();
	} else {
		for (const swap of swaps) Object.defineProperty(globalThis, swap.key, swap.dom);
	}
	installed = true;
}

/**
 * Empty the document body and restore the globals the registration replaced. The window stays
 * open for the next DOM test file. Idempotent.
 */
export function uninstallDom(): void {
	if (!installed || swaps === null) return;
	globalThis.document.body.replaceChildren();
	const target = globalThis as Record<PropertyKey, unknown>;
	for (const swap of swaps) {
		if (swap.original === undefined) delete target[swap.key];
		else Object.defineProperty(globalThis, swap.key, swap.original);
	}
	installed = false;
}
