import type { ReactNode } from "react";

/**
 * Overlay contract shared by every rail surface. Domains open layers through the store; one
 * `OverlayLayer` (rendered by the coordinator inside the `shell.overlay` slot) draws them. The
 * store is a plain observable (`getSnapshot`/`subscribe`) so `useSyncExternalStore` can read it.
 * It holds no timers and touches no DOM: auto-dismiss, focus handling and positioning belong to
 * `OverlayLayer`.
 */

export type OverlayPlacement =
	| "bottom-start"
	| "bottom-end"
	| "top-start"
	| "top-end"
	| "right-start"
	| "left-start";

export type ToastTone = "info" | "success" | "warn" | "error";

export interface OverlaySpec {
	/** `modal` centres the content above a mask; `anchored` positions it next to `anchor`. */
	readonly kind: "modal" | "anchored";
	/** Renders the layer content. Calling `close` removes the layer. */
	readonly render: (close: () => void) => ReactNode;
	/** Anchored layers: the element to position against, re-read on every layout pass. */
	readonly anchor?: () => Element | null;
	readonly placement?: OverlayPlacement;
	/** Close on Escape and on a pointer down outside the layer. Defaults to true. */
	readonly dismissible?: boolean;
	/** Called once when the layer is removed, whatever removed it. */
	readonly onClose?: () => void;
	/** Modal layers: id of the element that names the dialog (`aria-labelledby`). */
	readonly labelledBy?: string;
	/** Modal layers: id of the element that describes the dialog (`aria-describedby`). */
	readonly describedBy?: string;
	/** Modal layers: accessible name when no visible title exists (`aria-label`). */
	readonly label?: string;
	/** Modal layers: a click on the mask closes a dismissible layer. Defaults to true. */
	readonly closeOnMask?: boolean;
	/** Anchored layers: the layer is at least as wide as its anchor (select lists). */
	readonly matchAnchorWidth?: boolean;
}

/** Fields of an open layer that its owner may replace while it stays open. */
export type OverlayUpdate = Partial<Omit<OverlaySpec, "kind" | "onClose">>;

export interface ToastAction {
	readonly label: string;
	readonly run: () => void;
}

export interface ToastSpec {
	readonly text: string;
	readonly tone?: ToastTone;
	/** Milliseconds before `OverlayLayer` dismisses it; 0 keeps it until closed. Default 5000. */
	readonly durationMs?: number;
	readonly action?: ToastAction;
	/** Accessible name of the dismiss button; falls back to `OverlayLayer`'s `toastCloseLabel`. */
	readonly closeLabel?: string;
}

export interface OverlayEntry extends OverlaySpec {
	readonly id: number;
}

export interface ToastEntry extends ToastSpec {
	readonly id: number;
}

/** Layers in opening order (last is topmost) and toasts in arrival order. */
export interface OverlaySnapshot {
	readonly layers: readonly OverlayEntry[];
	readonly toasts: readonly ToastEntry[];
}

export interface OverlayHandle {
	readonly id: number;
	close(): void;
}

export interface OverlayStore {
	open(spec: OverlaySpec): OverlayHandle;
	toast(spec: ToastSpec): OverlayHandle;
	/**
	 * Replaces fields of an open layer (for example `render` after the owner re-rendered) so its
	 * content stays current. Unknown ids are ignored; `kind` and `onClose` never change.
	 */
	update(id: number, patch: OverlayUpdate): void;
	/** Removes a layer or toast by id; unknown ids are ignored. */
	close(id: number): void;
	closeAll(): void;
	getSnapshot(): OverlaySnapshot;
	subscribe(listener: () => void): () => void;
}

const EMPTY: OverlaySnapshot = { layers: [], toasts: [] };

export function createOverlayStore(): OverlayStore {
	let snapshot = EMPTY;
	let nextId = 1;
	const listeners = new Set<() => void>();

	const commit = (next: OverlaySnapshot): void => {
		snapshot = next;
		for (const listener of [...listeners]) listener();
	};

	const close = (id: number): void => {
		const layer = snapshot.layers.find((entry) => entry.id === id);
		if (layer !== undefined) {
			commit({ ...snapshot, layers: snapshot.layers.filter((entry) => entry.id !== id) });
			layer.onClose?.();
			return;
		}
		if (snapshot.toasts.some((entry) => entry.id === id)) {
			commit({ ...snapshot, toasts: snapshot.toasts.filter((entry) => entry.id !== id) });
		}
	};

	const handle = (id: number): OverlayHandle => ({ id, close: () => close(id) });

	return {
		open(spec) {
			const id = nextId++;
			commit({ ...snapshot, layers: [...snapshot.layers, { ...spec, id }] });
			return handle(id);
		},
		update(id, patch) {
			if (!snapshot.layers.some((entry) => entry.id === id)) return;
			commit({
				...snapshot,
				layers: snapshot.layers.map((entry) =>
					entry.id === id ? { ...entry, ...patch, id, kind: entry.kind } : entry,
				),
			});
		},
		toast(spec) {
			const id = nextId++;
			commit({ ...snapshot, toasts: [...snapshot.toasts, { ...spec, id }] });
			return handle(id);
		},
		close,
		closeAll() {
			const closing = snapshot.layers;
			if (closing.length === 0 && snapshot.toasts.length === 0) return;
			commit(EMPTY);
			for (const layer of closing) layer.onClose?.();
		},
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
