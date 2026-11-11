import { type MutableRefObject, type RefObject, useLayoutEffect, useRef, useState } from "react";

/** Joins truthy class names. */
export function cx(...names: readonly (string | false | null | undefined)[]): string {
	return names.filter(Boolean).join(" ");
}

/** Joins id references for `aria-describedby`; undefined when nothing remains. */
export function joinIds(
	...ids: readonly (string | false | null | undefined)[]
): string | undefined {
	const joined = ids.filter(Boolean).join(" ");
	return joined === "" ? undefined : joined;
}

/** A ref that always holds the latest value, for callbacks captured by long-lived closures. */
export function useLatest<T>(value: T): MutableRefObject<T> {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}

const FOCUSABLE = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

/** Keyboard-reachable descendants in document order. */
export function focusableWithin(root: Element): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
		(element) => element.getAttribute("aria-hidden") !== "true",
	);
}

/**
 * Remembers the element focused when the calling layer first renders (before any child effect
 * can move focus into the layer) and gives focus back to it on unmount, but only when focus is
 * still inside the layer or was dropped to the body, so a layer that closes because the user
 * moved on never steals focus back.
 */
export function useFocusReturn(container: RefObject<HTMLElement | null>): void {
	const [opener] = useState(() =>
		typeof document === "undefined" ? null : document.activeElement,
	);
	useLayoutEffect(
		() => () => {
			const active = document.activeElement;
			const node = container.current;
			const lostFocus =
				active === null || active === document.body || node?.contains(active) === true;
			if (!lostFocus || !(opener instanceof HTMLElement) || !opener.isConnected) return;
			opener.focus();
		},
		[container, opener],
	);
}

/** Index of the next enabled item from `from` in `step` direction, wrapping; -1 when none. */
export function nextEnabled(
	disabled: readonly boolean[],
	from: number,
	step: 1 | -1,
	wrap = true,
): number {
	const count = disabled.length;
	for (let offset = 1; offset <= count; offset++) {
		let index = from + step * offset;
		if (!wrap && (index < 0 || index >= count)) return -1;
		index = ((index % count) + count) % count;
		if (disabled[index] === false) return index;
	}
	return -1;
}

/** First (`step` 1) or last (`step` -1) enabled index; -1 when none. */
export function edgeEnabled(disabled: readonly boolean[], step: 1 | -1): number {
	return nextEnabled(disabled, step === 1 ? -1 : disabled.length, step, false);
}
