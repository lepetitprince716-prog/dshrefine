// The placeholder that stands in for the main conversation while the split is open, and the
// hook that follows its box. Panes live in a root-scoped overlay entry over this box, because
// the `main.conversation` entry remounts on every main-Session change (spike finding 1).
import { createElement, useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { Rect } from "../layout/geometry.ts";

export interface AnchorStore {
	get(): HTMLElement | null;
	set(element: HTMLElement | null): void;
	subscribe(listener: () => void): () => void;
}

export function createAnchorStore(): AnchorStore {
	let element: HTMLElement | null = null;
	const listeners = new Set<() => void>();
	return {
		get: () => element,
		set(next) {
			if (next === element) return;
			element = next;
			for (const listener of listeners) listener();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

/** The `main.conversation` shadow entry: an empty box the overlay covers. */
export function SplitAnchor({ anchor }: { readonly anchor: AnchorStore }) {
	const ref = useCallback(
		(element: HTMLDivElement | null) => {
			// Keep the latest mounted placeholder; an unmount clears only its own element.
			if (element !== null) anchor.set(element);
			else if (anchor.get()?.isConnected !== true) anchor.set(null);
		},
		[anchor],
	);
	return createElement("div", { ref, className: "dsp-anchor", "data-split-anchor": "" });
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
	if (a === null || b === null) return a === b;
	return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function measure(element: HTMLElement | null): Rect | null {
	if (element === null || !element.isConnected) return null;
	const box = element.getBoundingClientRect();
	if (box.width === 0 && box.height === 0) return null;
	return { left: box.left, top: box.top, width: box.width, height: box.height };
}

/**
 * The anchor's viewport box, or `null` while no placeholder is on screen (another main panel is
 * active). Follows size changes through a ResizeObserver and position changes through window
 * resize and a check on every animation frame while the box moves.
 */
export function useAnchorRect(anchor: AnchorStore): Rect | null {
	const element = useSyncExternalStore(anchor.subscribe, anchor.get);
	const [rect, setRect] = useState<Rect | null>(() => measure(element));
	useLayoutEffect(() => {
		let frame = 0;
		let settle = 0;
		let last: Rect | null | undefined;
		const update = (): boolean => {
			const next = measure(element);
			if (last !== undefined && sameRect(last, next)) return false;
			last = next;
			setRect((current) => (sameRect(current, next) ? current : next));
			return true;
		};
		// Sidebars animate their width; follow the box frame by frame until it holds still for a
		// few frames, then stop polling.
		const track = (): void => {
			cancelAnimationFrame(frame);
			settle = 0;
			const step = (): void => {
				settle = update() ? 0 : settle + 1;
				if (settle < 8) frame = requestAnimationFrame(step);
			};
			step();
		};
		track();
		if (element === null) return () => cancelAnimationFrame(frame);
		const observer = new ResizeObserver(track);
		observer.observe(element);
		observer.observe(document.documentElement);
		window.addEventListener("resize", track);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener("resize", track);
		};
	}, [element]);
	return rect;
}
