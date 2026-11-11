// Keyboard focus for one pane. The host's composer focuses itself whenever it mounts, unlocks or
// comes back online (dsh-client-ui-conversation `InputBar`), so after the split changes shape, or
// after a reconnect, the last composer to do so takes the keyboard, wherever it is. Two guards
// keep the keyboard in the active pane:
// - A request holds the keyboard in its pane for a bounded number of frames: it focuses the
//   pane's editor (the composer, or the picker's filter) once one exists, and takes the keyboard
//   back if a composer elsewhere grabs it, until the user presses a key or a pointer, or the
//   frames run out.
// - Focus arriving in an inactive pane activates it only when it came from Tab; otherwise it is
//   a composer focusing itself, and the keyboard goes back to the active pane.
// Adapted from rainfd/dsh-split-pane `src/client/panes/focus.ts` (MIT).
import type { PaneId } from "../layout/tree.ts";

/** Elements that accept typing inside a pane, in preference order. */
const EDITABLE = '[contenteditable="true"], textarea, input:not([type="hidden"])';
/** About one second at 60 Hz. */
const MAX_FRAMES = 60;
/** How long after a Tab press a focus change counts as the user's, in ms. */
const TAB_WINDOW_MS = 100;

let holding = 0;
let lastTabAt = Number.NEGATIVE_INFINITY;

/** Record Tab presses, so that focus moved by Tab can be told from focus moved by code. */
export function trackKeyboardNavigation(doc: Document): () => void {
	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Tab") lastTabAt = event.timeStamp;
	};
	doc.addEventListener("keydown", onKeyDown, true);
	return () => doc.removeEventListener("keydown", onKeyDown, true);
}

export type PaneFocusAction = "none" | "activate" | "refocus";

/**
 * What focus arriving in a pane calls for. A pointer press activates its pane by itself, so focus
 * activates only when Tab moved it. Other focus in an inactive pane sends the keyboard back to the
 * active pane, unless a focus request is already taking it there.
 * @param timeStamp - the focus event's time stamp.
 */
export function paneFocusAction(isActive: boolean, timeStamp: number): PaneFocusAction {
	if (isActive) return "none";
	if (timeStamp - lastTabAt <= TAB_WINDOW_MS) return "activate";
	return holding > 0 ? "none" : "refocus";
}

export function paneSelector(id: PaneId): string {
	return `[data-split-pane="${CSS.escape(id)}"]`;
}

/** Hold the keyboard in a pane for a while; returns a canceller. */
export function requestPaneFocus(id: PaneId): () => void {
	let frame = 0;
	let tries = 0;
	let active = true;
	holding++;
	const finish = (): void => {
		if (!active) return;
		active = false;
		holding--;
		cancelAnimationFrame(frame);
		document.removeEventListener("pointerdown", finish, true);
		document.removeEventListener("keydown", finish, true);
	};
	const attempt = (): void => {
		const pane = document.querySelector(paneSelector(id));
		const last = ++tries >= MAX_FRAMES;
		if (pane instanceof HTMLElement && !pane.contains(document.activeElement)) {
			const editable = pane.querySelector(".dsp-pane-main")?.querySelector(EDITABLE);
			if (editable instanceof HTMLElement) editable.focus({ preventScroll: true });
			else if (last) pane.focus({ preventScroll: true });
		}
		if (last) finish();
		else frame = requestAnimationFrame(attempt);
	};
	document.addEventListener("pointerdown", finish, true);
	document.addEventListener("keydown", finish, true);
	// Let the host's own focusing of newly mounted composers run first.
	frame = requestAnimationFrame(attempt);
	return finish;
}
