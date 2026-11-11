// Drags the split understands, and the document-level tracking that recognises the ones starting
// in the host sidebar. Host Session rows are draggable for the host's own reordering and carry the
// Session id in `text/plain`. A capture-phase `dragstart` stamps the bundle's MIME type next to it,
// so the drop surfaces claim only these drags and leave text and file drops to their usual targets
// (YEYEYEYESHIFU/dsh-split-screen audit S6 and yuloop/dsh-web-split, MIT, rewritten).
import type { Rect } from "../layout/geometry.ts";
import type { PaneId, SessionId } from "../layout/tree.ts";

/** Data types the bundle writes on a drag it starts or recognises. */
export const MIME = {
	session: "application/x-dsh-split-session",
	pane: "application/x-dsh-split-pane",
	fresh: "application/x-dsh-split-new",
	empty: "application/x-dsh-split-empty",
} as const;

export type DragPayload =
	| { readonly kind: "session"; readonly sessionId: SessionId }
	| { readonly kind: "pane"; readonly paneId: PaneId }
	/** A new conversation, created on drop. */
	| { readonly kind: "new" }
	/** An empty pane that shows the Session picker. */
	| { readonly kind: "empty" };

export interface DragState {
	readonly payload: DragPayload;
	/** The host row a Session drag started from, used to cancel the host's reorder. */
	readonly source: Element | null;
}

export interface DragStore {
	getSnapshot(): DragState | null;
	subscribe(listener: () => void): () => void;
	start(state: DragState): void;
	end(): void;
}

export function createDragStore(): DragStore {
	let state: DragState | null = null;
	const listeners = new Set<() => void>();
	const set = (next: DragState | null): void => {
		if (next === state) return;
		state = next;
		for (const listener of listeners) listener();
	};
	return {
		getSnapshot: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		start: set,
		end: () => set(null),
	};
}

/** Host selectors, dsh 0.2.1 (`dsh-client-ui-workspace` rows, `dsh-client-ui-sidebar` button). */
const SESSION_ROW = '[data-row-key^="session:"]';
const NEW_SESSION_BUTTON = '[class*="_sidebarCol"] button[class*="_newSession"]';
const SESSION_KEY_PREFIX = "session:";

export function sessionIdOfRow(row: Element): SessionId | undefined {
	const key = row.getAttribute("data-row-key");
	if (key === null || !key.startsWith(SESSION_KEY_PREFIX)) return undefined;
	const id = key.slice(SESSION_KEY_PREFIX.length);
	return id === "" ? undefined : id;
}

/** Write the payload under the bundle's MIME type; called during `dragstart` only. */
export function stampDrag(transfer: DataTransfer, payload: DragPayload): void {
	if (payload.kind === "session") transfer.setData(MIME.session, payload.sessionId);
	else if (payload.kind === "pane") transfer.setData(MIME.pane, payload.paneId);
	else if (payload.kind === "new") transfer.setData(MIME.fresh, "1");
	else transfer.setData(MIME.empty, "1");
}

/** Whether a drag carries a split payload; `types` is readable during `dragover`. */
export function isSplitDrag(types: readonly string[]): boolean {
	return !types.includes("Files") && Object.values(MIME).some((type) => types.includes(type));
}

/**
 * Use a small labelled chip as the drag image. The chip must be rendered when `setDragImage`
 * runs, so it is placed off screen and removed on the next frame.
 */
export function setDragGhost(transfer: DataTransfer, label: string): void {
	const ghost = document.createElement("div");
	ghost.className = "rf-root dsp-ghost";
	ghost.textContent = label;
	document.body.append(ghost);
	transfer.setDragImage(ghost, 14, 14);
	requestAnimationFrame(() => ghost.remove());
}

/** Start a drag from one of the bundle's own controls. */
export function startOwnDrag(
	transfer: DataTransfer | null,
	store: DragStore,
	payload: DragPayload,
	ghost: string,
): void {
	if (transfer === null) return;
	transfer.effectAllowed = payload.kind === "pane" ? "move" : "copy";
	stampDrag(transfer, payload);
	setDragGhost(transfer, ghost);
	store.start({ payload, source: null });
}

/** The drop effect a target reports; it must be one the source allows, or the drop is refused. */
export function dropEffectFor(allowed: string): "copy" | "move" {
	const value = allowed.toLowerCase();
	return value === "all" || value === "uninitialized" || value.includes("move") ? "move" : "copy";
}

function elementOf(target: EventTarget | null): Element | null {
	return target instanceof Element ? target : null;
}

/**
 * Recognise drags that start in the host sidebar: Session rows, and the New session button,
 * which is made draggable on pointer down.
 * @returns a disposer that removes the listeners.
 */
export function trackHostDrags(doc: Document, store: DragStore): () => void {
	const onPointerDown = (event: Event): void => {
		const button = elementOf(event.target)?.closest(NEW_SESSION_BUTTON);
		if (button instanceof HTMLElement && !button.draggable) button.draggable = true;
	};
	const onDragStart = (event: DragEvent): void => {
		const target = elementOf(event.target);
		const transfer = event.dataTransfer;
		if (target === null || transfer === null) return;
		const row = target.closest(SESSION_ROW);
		const sessionId = row === null ? undefined : sessionIdOfRow(row);
		if (row !== null && sessionId !== undefined) {
			const payload: DragPayload = { kind: "session", sessionId };
			stampDrag(transfer, payload);
			store.start({ payload, source: row });
			return;
		}
		if (target.closest(NEW_SESSION_BUTTON) === null) return;
		const payload: DragPayload = { kind: "new" };
		transfer.effectAllowed = "copy";
		stampDrag(transfer, payload);
		store.start({ payload, source: null });
	};
	const onDragEnd = (): void => store.end();
	// Pointer events pause during a drag; one arriving while a drag is recorded means its source
	// left the document before `dragend` could reach it.
	const onPointerMove = (): void => {
		if (store.getSnapshot() !== null) store.end();
	};
	doc.addEventListener("pointerdown", onPointerDown, true);
	doc.addEventListener("dragstart", onDragStart, true);
	doc.addEventListener("dragend", onDragEnd, true);
	doc.addEventListener("pointermove", onPointerMove, true);
	return () => {
		doc.removeEventListener("pointerdown", onPointerDown, true);
		doc.removeEventListener("dragstart", onDragStart, true);
		doc.removeEventListener("dragend", onDragEnd, true);
		doc.removeEventListener("pointermove", onPointerMove, true);
	};
}

/**
 * Point the host's reorder hover at the dragged row itself. The host commits the last hovered
 * row when a drag ends outside its list, and a commit onto the dragged row does nothing; without
 * this, opening a Session in a pane would also reorder the sidebar.
 */
export function settleHostReorder(source: Element | null): void {
	if (!(source instanceof HTMLElement) || !source.isConnected) return;
	const box = source.getBoundingClientRect();
	let transfer: DataTransfer | undefined;
	try {
		transfer = new DataTransfer();
	} catch {
		return;
	}
	source.dispatchEvent(
		new DragEvent("dragover", {
			bubbles: true,
			cancelable: true,
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height / 4,
			dataTransfer: transfer,
		}),
	);
}

/** The host's centre column (header and conversation), the drop target while no split is open. */
const CENTER_COLUMN = '[class*="_centerCol"]';

/** Measure the centre column; `null` when it is missing or too small to be the conversation. */
export function measureCenterColumn(doc: Document): Rect | null {
	const column = doc.querySelector(CENTER_COLUMN);
	if (column === null) return null;
	const box = column.getBoundingClientRect();
	if (box.width < 120 || box.height < 120) return null;
	return { left: box.left, top: box.top, width: box.width, height: box.height };
}
