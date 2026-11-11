import {
	type CSSProperties,
	createContext,
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { OverlayEntry, OverlayHandle, OverlaySpec, OverlayStore } from "./overlay.ts";
import { computeLayerPosition, type LayerPosition } from "./position.ts";
import { TimedToast } from "./toast.tsx";
import { focusableWithin, useFocusReturn, useLatest } from "./util.ts";

const OverlayContext = createContext<OverlayStore | null>(null);

/** Makes one shared overlay store available to kit components below it. */
export function OverlayProvider({
	store,
	children,
}: {
	readonly store: OverlayStore;
	readonly children?: ReactNode;
}) {
	return <OverlayContext.Provider value={store}>{children}</OverlayContext.Provider>;
}

/** The overlay store from the nearest `OverlayProvider` (or `OverlayLayer` content). */
export function useOverlay(): OverlayStore {
	const store = useContext(OverlayContext);
	if (store === null) throw new Error("useOverlay: no OverlayProvider above this component");
	return store;
}

/**
 * Keeps one overlay layer open while `open` is true and refreshes its content on every render of
 * the caller. `spec.onClose` runs only when something other than the caller closed the layer
 * (Escape, an outside pointer down, the mask, `close()` from the content).
 */
export function useOverlayLayer(open: boolean, spec: OverlaySpec): void {
	const store = useOverlay();
	const specRef = useLatest(spec);
	const handle = useRef<OverlayHandle | null>(null);
	const fresh = useRef(false);

	useLayoutEffect(() => {
		if (!open) return;
		let owned = true;
		const opened = store.open({
			...specRef.current,
			onClose: () => {
				handle.current = null;
				if (owned) specRef.current.onClose?.();
			},
		});
		handle.current = opened;
		fresh.current = true;
		return () => {
			owned = false;
			handle.current = null;
			opened.close();
		};
	}, [open, store, specRef]);

	useLayoutEffect(() => {
		if (fresh.current) {
			fresh.current = false;
			return;
		}
		if (handle.current === null) return;
		const { kind: _kind, onClose: _onClose, ...patch } = spec;
		store.update(handle.current.id, patch);
	});
}

export interface OverlayLayerProps {
	readonly store: OverlayStore;
	/** Accessible name of every toast's dismiss button unless the toast sets `closeLabel`. */
	readonly toastCloseLabel?: string;
}

/**
 * Draws every layer and toast of `store`. The root is click-through (`pointer-events: none`);
 * masks, layers and toasts opt back in. Escape closes the topmost dismissible layer; a pointer
 * down outside closes anchored layers from the top down to the first one that contains it.
 */
export function OverlayLayer({ store, toastCloseLabel }: OverlayLayerProps) {
	const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
	const nodes = useRef(new Map<number, HTMLElement>());

	useEffect(() => {
		const onKeyDown = (event: globalThis.KeyboardEvent): void => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			const top = store.getSnapshot().layers.at(-1);
			if (top === undefined || top.dismissible === false) return;
			event.preventDefault();
			event.stopPropagation();
			store.close(top.id);
		};
		const onPointerDown = (event: Event): void => {
			const target = event.target instanceof Node ? event.target : null;
			const layers = store.getSnapshot().layers;
			for (let index = layers.length - 1; index >= 0; index--) {
				const layer = layers[index];
				if (layer === undefined || layer.kind !== "anchored") return;
				if (target !== null && nodes.current.get(layer.id)?.contains(target)) return;
				if (target !== null && layer.anchor?.()?.contains(target)) return;
				if (layer.dismissible === false) return;
				store.close(layer.id);
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [store]);

	const register = useCallback((id: number, node: HTMLElement | null) => {
		if (node === null) nodes.current.delete(id);
		else nodes.current.set(id, node);
	}, []);

	const topModal = snapshot.layers.findLast((entry) => entry.kind === "modal")?.id;
	return (
		<OverlayContext.Provider value={store}>
			{/* Portaled like the host's own Modal, Menu and Toast: the host's full-screen right panel
			    stacks above its overlay slot, so a layer rendered in place would sit under it. */}
			{createPortal(
				<div className="rf-root rf-overlay">
					{snapshot.layers.map((entry) =>
						entry.kind === "modal" ? (
							<ModalLayer
								key={entry.id}
								entry={entry}
								store={store}
								register={register}
								isTop={entry.id === topModal}
							/>
						) : (
							<AnchoredLayer key={entry.id} entry={entry} store={store} register={register} />
						),
					)}
					{snapshot.toasts.length === 0 ? null : (
						<div className="rf-toasts">
							{snapshot.toasts.map((entry) => (
								<TimedToast
									key={entry.id}
									entry={entry}
									store={store}
									fallbackCloseLabel={toastCloseLabel}
								/>
							))}
						</div>
					)}
				</div>,
				document.body,
			)}
		</OverlayContext.Provider>
	);
}

interface LayerProps {
	readonly entry: OverlayEntry;
	readonly store: OverlayStore;
	readonly register: (id: number, node: HTMLElement | null) => void;
}

function ModalLayer({ entry, store, register, isTop }: LayerProps & { readonly isTop: boolean }) {
	const dialog = useRef<HTMLDivElement | null>(null);
	const downOnMask = useRef(false);
	const close = useCallback(() => store.close(entry.id), [store, entry.id]);
	const topRef = useLatest(isTop);
	useFocusReturn(dialog);

	useLayoutEffect(() => {
		const node = dialog.current;
		if (node === null) return;
		const pick = (): HTMLElement =>
			node.querySelector<HTMLElement>("[data-autofocus]") ??
			focusableWithin(node).find((element) => !element.hasAttribute("data-rf-close")) ??
			node;
		let placed = pick();
		placed.focus();
		// Content that loads after opening may add the preferred target, or unmount the focused
		// element. Re-place focus only while the user has not moved it: it still sits where this
		// layer put it, or it fell to the document body.
		const observer = new MutationObserver(() => {
			if (!topRef.current) return;
			const active = document.activeElement;
			const dropped = active === null || active === document.body;
			if (!dropped && active !== placed) return;
			const next = pick();
			if (next === active) return;
			placed = next;
			next.focus();
		});
		observer.observe(node, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-autofocus", "disabled"],
		});
		return () => observer.disconnect();
	}, [topRef]);

	const trapTab = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (event.key !== "Tab" || !isTop || dialog.current === null) return;
		const items = focusableWithin(dialog.current);
		const first = items[0];
		const last = items.at(-1);
		const active = document.activeElement;
		if (first === undefined || last === undefined) {
			event.preventDefault();
			dialog.current.focus();
			return;
		}
		if (event.shiftKey && (active === first || active === dialog.current)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	};

	const maskCloses = entry.dismissible !== false && entry.closeOnMask !== false;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the mask click is a pointer shortcut; Escape and the close button cover the keyboard
		<div
			className="rf-modal-mask"
			data-top={isTop || undefined}
			onPointerDown={(event) => {
				downOnMask.current = event.target === event.currentTarget;
			}}
			onClick={(event) => {
				const startedHere = downOnMask.current;
				downOnMask.current = false;
				if (maskCloses && startedHere && event.target === event.currentTarget) close();
			}}
			role="presentation"
		>
			<div
				ref={(node) => {
					dialog.current = node;
					register(entry.id, node);
				}}
				role="dialog"
				aria-modal="true"
				aria-labelledby={entry.labelledBy}
				aria-describedby={entry.describedBy}
				aria-label={entry.label}
				tabIndex={-1}
				className="rf-layer rf-modal-layer"
				onKeyDown={trapTab}
			>
				{entry.render(close)}
			</div>
		</div>
	);
}

function samePosition(
	a: LayerPosition | null,
	b: LayerPosition,
	width: number,
	prev: number,
): boolean {
	return (
		a !== null &&
		a.top === b.top &&
		a.left === b.left &&
		a.placement === b.placement &&
		width === prev
	);
}

function AnchoredLayer({ entry, store, register }: LayerProps) {
	const layer = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState<LayerPosition | null>(null);
	const [anchorWidth, setAnchorWidth] = useState(0);
	// Only a missing anchor hides the layer. The first, unmeasured render stays visible: `measure`
	// runs in a layout effect and re-renders before paint, and content that focuses itself on
	// mount (menus, popovers) runs its layout effects first, when a hidden layer would refuse focus.
	const [isOrphan, setOrphan] = useState(false);
	const close = useCallback(() => store.close(entry.id), [store, entry.id]);
	const entryRef = useLatest(entry);
	const positionRef = useLatest({ position, anchorWidth });
	useFocusReturn(layer);

	const measure = useCallback(() => {
		const node = layer.current;
		const anchor = entryRef.current.anchor?.() ?? null;
		if (node === null || anchor === null) {
			if (positionRef.current.position !== null) setPosition(null);
			setOrphan(true);
			return;
		}
		setOrphan(false);
		const anchorRect = anchor.getBoundingClientRect();
		const own = node.getBoundingClientRect();
		const next = computeLayerPosition(
			anchorRect,
			{
				width: Math.max(own.width, entryRef.current.matchAnchorWidth ? anchorRect.width : 0),
				height: own.height,
			},
			{ width: window.innerWidth, height: window.innerHeight },
			entryRef.current.placement ?? "bottom-start",
		);
		const current = positionRef.current;
		if (samePosition(current.position, next, anchorRect.width, current.anchorWidth)) return;
		setPosition(next);
		setAnchorWidth(anchorRect.width);
	}, [entryRef, positionRef]);

	useLayoutEffect(() => {
		measure();
	});

	useEffect(() => {
		window.addEventListener("scroll", measure, true);
		window.addEventListener("resize", measure);
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
		if (observer !== null && layer.current !== null) observer.observe(layer.current);
		return () => {
			window.removeEventListener("scroll", measure, true);
			window.removeEventListener("resize", measure);
			observer?.disconnect();
		};
	}, [measure]);

	const style: CSSProperties = {
		top: position?.top ?? 0,
		left: position?.left ?? 0,
		...(isOrphan ? { visibility: "hidden" } : {}),
		...(entry.matchAnchorWidth ? { minWidth: anchorWidth } : {}),
	};
	return (
		<div
			ref={(node) => {
				layer.current = node;
				register(entry.id, node);
			}}
			className="rf-layer rf-anchored-layer"
			data-placement={position?.placement ?? entry.placement ?? "bottom-start"}
			style={style}
		>
			{entry.render(close)}
		</div>
	);
}
