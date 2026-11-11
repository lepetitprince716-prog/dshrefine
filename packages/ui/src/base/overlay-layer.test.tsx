import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, jest, test } from "bun:test";
import { useLayoutEffect, useRef, useState } from "react";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { createOverlayStore, type OverlayStore } from "./overlay.ts";
import { OverlayLayer, OverlayProvider, useOverlay, useOverlayLayer } from "./overlay-layer.tsx";
import { LAYER_GAP } from "./position.ts";
import { TOAST_DURATION_MS } from "./toast.tsx";

const { act, cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);

const originalRect = HTMLElement.prototype.getBoundingClientRect;
afterEach(() => {
	cleanup();
	jest.useRealTimers();
	HTMLElement.prototype.getBoundingClientRect = originalRect;
});

function mountLayer(store: OverlayStore, toastCloseLabel?: string) {
	return render(
		<OverlayLayer store={store} {...(toastCloseLabel === undefined ? {} : { toastCloseLabel })} />,
	);
}

function domRect(left: number, top: number, width: number, height: number): DOMRect {
	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}

describe("OverlayLayer modal layers", () => {
	test("the root is a click-through rf-root portaled to the body and starts empty", () => {
		const store = createOverlayStore();
		const view = mountLayer(store);
		// Rendered in place, the layer would sit under the host's full-screen right panel.
		expect(view.container.querySelector(".rf-overlay")).toBeNull();
		const root = document.body.querySelector(":scope > .rf-overlay") as HTMLElement;
		expect(root.className).toBe("rf-root rf-overlay");
		expect(root.childElementCount).toBe(0);
		act(() => {
			store.open({ kind: "modal", render: () => <p>Body</p> });
		});
		expect(root.querySelector('[role="dialog"]')).not.toBeNull();
		expect(view.container.querySelector('[role="dialog"]')).toBeNull();
	});

	test("opening and closing through the store adds and removes a labelled dialog", () => {
		const store = createOverlayStore();
		const view = mountLayer(store);
		let handle = { id: 0, close: () => {} };
		act(() => {
			handle = store.open({
				kind: "modal",
				label: "Confirm removal",
				render: (close) => (
					<button type="button" onClick={close}>
						Confirm
					</button>
				),
			});
		});
		const dialog = view.getByRole("dialog", { name: "Confirm removal" });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(document.activeElement).toBe(view.getByRole("button", { name: "Confirm" }));
		act(() => handle.close());
		expect(view.queryByRole("dialog")).toBeNull();
		act(() => {
			store.open({
				kind: "modal",
				label: "Again",
				render: (close) => (
					<button type="button" onClick={close}>
						Done
					</button>
				),
			});
		});
		fireEvent.click(view.getByRole("button", { name: "Done" }));
		expect(store.getSnapshot().layers).toEqual([]);
	});

	test("a dialog without focusable content focuses itself and keeps Tab inside", () => {
		const store = createOverlayStore();
		const view = mountLayer(store);
		act(() => {
			store.open({ kind: "modal", label: "Info", render: () => <p>Read only</p> });
		});
		const dialog = view.getByRole("dialog", { name: "Info" });
		expect(document.activeElement).toBe(dialog);
		fireEvent.keyDown(dialog, { key: "Tab" });
		expect(document.activeElement).toBe(dialog);
	});

	test("Escape closes only the topmost layer, and data-autofocus wins initial focus", () => {
		const store = createOverlayStore();
		const closed: string[] = [];
		const view = mountLayer(store);
		act(() => {
			store.open({
				kind: "modal",
				label: "First",
				onClose: () => closed.push("first"),
				render: () => <input aria-label="a" />,
			});
			store.open({
				kind: "modal",
				label: "Second",
				onClose: () => closed.push("second"),
				render: () => (
					<>
						<input aria-label="b" />
						<input aria-label="c" data-autofocus="" />
					</>
				),
			});
		});
		expect(document.activeElement).toBe(view.getByRole("textbox", { name: "c" }));
		fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
		expect(closed).toEqual(["second"]);
		expect(view.getByRole("dialog", { name: "First" })).toBeDefined();
		expect(view.queryByRole("dialog", { name: "Second" })).toBeNull();
	});

	test("content that loads after opening takes focus until the user moves it", async () => {
		const store = createOverlayStore();
		let finish: (() => void) | undefined;
		function Loading() {
			const [ready, setReady] = useState(false);
			finish = () => setReady(true);
			return (
				<>
					<button type="button">Cancel</button>
					{ready ? (
						<input aria-label="name" data-autofocus="" />
					) : (
						<button type="button">Retry</button>
					)}
				</>
			);
		}
		const view = mountLayer(store);
		act(() => {
			store.open({ kind: "modal", label: "Late", render: () => <Loading /> });
		});
		expect(document.activeElement).toBe(view.getByRole("button", { name: "Cancel" }));
		await act(async () => {
			finish?.();
		});
		expect(document.activeElement).toBe(view.getByRole("textbox", { name: "name" }));
	});

	test("focus that drops to the body after an unmount returns to the dialog", async () => {
		const store = createOverlayStore();
		let swap: (() => void) | undefined;
		function Swapping() {
			const [gone, setGone] = useState(false);
			swap = () => setGone(true);
			return gone ? (
				<button key="close" type="button">
					Close
				</button>
			) : (
				<button key="retry" type="button" data-autofocus="">
					Retry
				</button>
			);
		}
		const view = mountLayer(store);
		act(() => {
			store.open({ kind: "modal", label: "Swap", render: () => <Swapping /> });
		});
		const user = view.getByRole("button", { name: "Retry" });
		expect(document.activeElement).toBe(user);
		await act(async () => {
			swap?.();
		});
		expect(document.activeElement).toBe(view.getByRole("button", { name: "Close" }));
	});

	test("a user who moved focus keeps it when content changes", async () => {
		const store = createOverlayStore();
		let finish: (() => void) | undefined;
		function Loading() {
			const [ready, setReady] = useState(false);
			finish = () => setReady(true);
			return (
				<>
					<button type="button">Cancel</button>
					<button type="button">Other</button>
					{ready ? <input aria-label="name" data-autofocus="" /> : null}
				</>
			);
		}
		const view = mountLayer(store);
		act(() => {
			store.open({ kind: "modal", label: "Moved", render: () => <Loading /> });
		});
		const other = view.getByRole("button", { name: "Other" });
		other.focus();
		await act(async () => {
			finish?.();
		});
		expect(document.activeElement).toBe(other);
	});

	test("Escape that another handler already handled is ignored", () => {
		const store = createOverlayStore();
		mountLayer(store);
		act(() => {
			store.open({ kind: "modal", label: "Stay", render: () => null });
		});
		const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
		event.preventDefault();
		act(() => {
			document.dispatchEvent(event);
		});
		expect(store.getSnapshot().layers.length).toBe(1);
	});
});

describe("OverlayLayer anchored layers", () => {
	function stubRects(
		anchor: HTMLElement,
		anchorRect: DOMRect,
		layerSize: { width: number; height: number },
	) {
		HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
			if (this === anchor) return anchorRect;
			if (this.classList.contains("rf-anchored-layer"))
				return domRect(0, 0, layerSize.width, layerSize.height);
			return originalRect.call(this);
		};
	}

	test("places below the anchor and flips above when the bottom would overflow", () => {
		const store = createOverlayStore();
		const view = render(
			<>
				<button type="button" data-testid="anchor">
					anchor
				</button>
				<OverlayLayer store={store} />
			</>,
		);
		const anchor = view.getByTestId("anchor");
		const viewportHeight = window.innerHeight;
		stubRects(anchor, domRect(100, 100, 80, 24), { width: 200, height: 150 });
		act(() => {
			store.open({
				kind: "anchored",
				anchor: () => anchor,
				placement: "bottom-start",
				render: () => <div>menu</div>,
			});
		});
		const layer = view.getByText("menu").parentElement as HTMLElement;
		expect(layer.style.top).toBe(`${124 + LAYER_GAP}px`);
		expect(layer.style.left).toBe("100px");
		expect(layer.getAttribute("data-placement")).toBe("bottom-start");
		expect(layer.style.visibility).toBe("");

		const lowTop = viewportHeight - 40;
		stubRects(anchor, domRect(100, lowTop, 80, 24), { width: 200, height: 150 });
		act(() => {
			window.dispatchEvent(new Event("scroll"));
		});
		expect(layer.getAttribute("data-placement")).toBe("top-start");
		expect(layer.style.top).toBe(`${lowTop - LAYER_GAP - 150}px`);
	});

	test("re-measures on resize and matches the anchor width when asked", () => {
		const store = createOverlayStore();
		const view = render(
			<>
				<button type="button" data-testid="anchor">
					anchor
				</button>
				<OverlayLayer store={store} />
			</>,
		);
		const anchor = view.getByTestId("anchor");
		stubRects(anchor, domRect(40, 40, 300, 32), { width: 120, height: 100 });
		act(() => {
			store.open({
				kind: "anchored",
				anchor: () => anchor,
				matchAnchorWidth: true,
				render: () => <div>list</div>,
			});
		});
		const layer = view.getByText("list").parentElement as HTMLElement;
		expect(layer.style.minWidth).toBe("300px");
		stubRects(anchor, domRect(60, 40, 320, 32), { width: 120, height: 100 });
		act(() => {
			window.dispatchEvent(new Event("resize"));
		});
		expect(layer.style.left).toBe("60px");
		expect(layer.style.minWidth).toBe("320px");
	});

	test("stays hidden while its anchor is missing", () => {
		const store = createOverlayStore();
		const view = mountLayer(store);
		act(() => {
			store.open({ kind: "anchored", anchor: () => null, render: () => <div>orphan</div> });
		});
		expect((view.getByText("orphan").parentElement as HTMLElement).style.visibility).toBe("hidden");
	});

	test("is not hidden while its content mounts, so the content can take focus", () => {
		// Browsers refuse focus inside a `visibility: hidden` layer; happy-dom does not, so the
		// style the content sees in its own mount effect is what the test checks.
		const store = createOverlayStore();
		const view = render(
			<>
				<button type="button" data-testid="anchor">
					anchor
				</button>
				<OverlayLayer store={store} />
			</>,
		);
		const anchor = view.getByTestId("anchor");
		stubRects(anchor, domRect(100, 100, 80, 24), { width: 160, height: 64 });
		const seen: string[] = [];
		function FocusOnMount() {
			const self = useRef<HTMLButtonElement | null>(null);
			useLayoutEffect(() => {
				seen.push(self.current?.parentElement?.style.visibility ?? "no layer");
				self.current?.focus();
			}, []);
			return (
				<button type="button" ref={self}>
					first
				</button>
			);
		}
		act(() => {
			store.open({ kind: "anchored", anchor: () => anchor, render: () => <FocusOnMount /> });
		});
		expect(seen).toEqual([""]);
		expect(document.activeElement).toBe(view.getByText("first"));
	});

	test("outside pointer down closes anchored layers from the top down to the one that contains it", () => {
		const store = createOverlayStore();
		const closed: string[] = [];
		const view = mountLayer(store);
		act(() => {
			store.open({
				kind: "anchored",
				onClose: () => closed.push("outer"),
				render: () => <div>outer</div>,
			});
			store.open({
				kind: "anchored",
				onClose: () => closed.push("inner"),
				render: () => <div>inner</div>,
			});
		});
		fireEvent.pointerDown(view.getByText("outer"));
		expect(closed).toEqual(["inner"]);
		fireEvent.pointerDown(document.body);
		expect(closed).toEqual(["inner", "outer"]);
	});

	test("non-dismissible anchored layers ignore Escape and outside pointer down", () => {
		const store = createOverlayStore();
		mountLayer(store);
		act(() => {
			store.open({ kind: "anchored", dismissible: false, render: () => <div>pinned</div> });
		});
		fireEvent.pointerDown(document.body);
		fireEvent.keyDown(document.body, { key: "Escape" });
		expect(store.getSnapshot().layers.length).toBe(1);
	});
});

describe("OverlayLayer toasts", () => {
	test("auto-dismiss after the default duration; error toasts are alerts", () => {
		jest.useFakeTimers();
		const store = createOverlayStore();
		const view = mountLayer(store);
		act(() => {
			store.toast({ text: "Saved", tone: "success" });
			store.toast({ text: "Push failed", tone: "error" });
		});
		expect(view.getByRole("status").textContent).toBe("Saved");
		expect(view.getByRole("alert").textContent).toBe("Push failed");
		act(() => {
			jest.advanceTimersByTime(TOAST_DURATION_MS - 1);
		});
		expect(store.getSnapshot().toasts.length).toBe(2);
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(store.getSnapshot().toasts).toEqual([]);
		expect(document.body.querySelector(".rf-toasts")).toBeNull();
	});

	test("hover pauses the timer and leaving resumes with the remaining time", () => {
		jest.useFakeTimers();
		const store = createOverlayStore();
		const view = mountLayer(store);
		act(() => {
			store.toast({ text: "Copied", durationMs: 1000 });
		});
		act(() => {
			jest.advanceTimersByTime(600);
		});
		const toast = view.getByRole("status");
		fireEvent.mouseEnter(toast);
		act(() => {
			jest.advanceTimersByTime(10_000);
		});
		expect(store.getSnapshot().toasts.length).toBe(1);
		fireEvent.mouseLeave(toast);
		act(() => {
			jest.advanceTimersByTime(399);
		});
		expect(store.getSnapshot().toasts.length).toBe(1);
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(store.getSnapshot().toasts).toEqual([]);
	});

	test("durationMs 0 is sticky; the dismiss button uses the layer's fallback label", () => {
		jest.useFakeTimers();
		const store = createOverlayStore();
		const view = mountLayer(store, "Dismiss");
		act(() => {
			store.toast({ text: "Sticky", durationMs: 0 });
			store.toast({ text: "Own label", durationMs: 0, closeLabel: "Hide" });
		});
		act(() => {
			jest.advanceTimersByTime(60_000);
		});
		expect(store.getSnapshot().toasts.length).toBe(2);
		fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
		fireEvent.click(view.getByRole("button", { name: "Hide" }));
		expect(store.getSnapshot().toasts).toEqual([]);
	});

	test("the action runs and closes the toast; without any label there is no dismiss button", () => {
		const store = createOverlayStore();
		const ran: string[] = [];
		const view = mountLayer(store);
		act(() => {
			store.toast({
				text: "Workspace removed",
				durationMs: 0,
				action: { label: "Undo", run: () => ran.push("undo") },
			});
		});
		expect(view.getAllByRole("button").map((button) => button.textContent)).toEqual(["Undo"]);
		fireEvent.click(view.getByRole("button", { name: "Undo" }));
		expect(ran).toEqual(["undo"]);
		expect(store.getSnapshot().toasts).toEqual([]);
	});
});

describe("OverlayProvider and useOverlayLayer", () => {
	test("useOverlay throws a clear error without a provider", () => {
		function Orphan() {
			useOverlay();
			return null;
		}
		const errors = console.error;
		console.error = () => {};
		try {
			expect(() => render(<Orphan />)).toThrow(
				"useOverlay: no OverlayProvider above this component",
			);
		} finally {
			console.error = errors;
		}
	});

	test("the owner closing its layer does not call onClose; a user dismissal does", () => {
		const store = createOverlayStore();
		const calls: string[] = [];
		function Owner() {
			const [open, setOpen] = useState(false);
			const [label, setLabel] = useState("v1");
			useOverlayLayer(open, {
				kind: "anchored",
				onClose: () => {
					calls.push("onClose");
					setOpen(false);
				},
				render: () => <div>{label}</div>,
			});
			return (
				<>
					<button type="button" onClick={() => setOpen(!open)}>
						toggle
					</button>
					<button type="button" onClick={() => setLabel("v2")}>
						relabel
					</button>
				</>
			);
		}
		const view = render(
			<OverlayProvider store={store}>
				<Owner />
				<OverlayLayer store={store} />
			</OverlayProvider>,
		);
		fireEvent.click(view.getByRole("button", { name: "toggle" }));
		expect(view.getByText("v1")).toBeDefined();
		fireEvent.click(view.getByRole("button", { name: "relabel" }));
		expect(view.getByText("v2")).toBeDefined();
		expect(store.getSnapshot().layers.length).toBe(1);
		fireEvent.click(view.getByRole("button", { name: "toggle" }));
		expect(store.getSnapshot().layers).toEqual([]);
		expect(calls).toEqual([]);
		fireEvent.click(view.getByRole("button", { name: "toggle" }));
		fireEvent.keyDown(document.body, { key: "Escape" });
		expect(calls).toEqual(["onClose"]);
		expect(store.getSnapshot().layers).toEqual([]);
	});

	test("unmounting the owner closes its layer", () => {
		const store = createOverlayStore();
		function Owner() {
			useOverlayLayer(true, { kind: "modal", label: "Owned", render: () => null });
			return null;
		}
		function Host() {
			const [shown, setShown] = useState(true);
			return (
				<>
					{shown ? <Owner /> : null}
					<button type="button" onClick={() => setShown(false)}>
						unmount
					</button>
				</>
			);
		}
		const view = render(
			<OverlayProvider store={store}>
				<Host />
				<OverlayLayer store={store} />
			</OverlayProvider>,
		);
		expect(view.getByRole("dialog", { name: "Owned" })).toBeDefined();
		fireEvent.click(view.getByRole("button", { name: "unmount" }));
		expect(store.getSnapshot().layers).toEqual([]);
	});
});
