import { describe, expect, test } from "bun:test";
import { createOverlayStore } from "./overlay.ts";

const render = () => null;

describe("createOverlayStore", () => {
	test("open, toast and close update an immutable snapshot and notify subscribers", () => {
		const store = createOverlayStore();
		let notified = 0;
		const unsubscribe = store.subscribe(() => {
			notified++;
		});
		const before = store.getSnapshot();
		const modal = store.open({ kind: "modal", render });
		const toast = store.toast({ text: "Saved", tone: "success" });
		expect(before).toEqual({ layers: [], toasts: [] });
		expect(store.getSnapshot().layers.map((entry) => entry.id)).toEqual([modal.id]);
		expect(store.getSnapshot().toasts.map((entry) => entry.text)).toEqual(["Saved"]);
		toast.close();
		modal.close();
		expect(store.getSnapshot()).toEqual({ layers: [], toasts: [] });
		expect(notified).toBe(4);
		unsubscribe();
		store.toast({ text: "Unseen" });
		expect(notified).toBe(4);
	});

	test("onClose runs exactly once for each removed layer and unknown ids are ignored", () => {
		const store = createOverlayStore();
		const closed: string[] = [];
		const first = store.open({ kind: "modal", render, onClose: () => closed.push("first") });
		store.open({ kind: "anchored", render, onClose: () => closed.push("second") });
		first.close();
		first.close();
		store.close(999);
		store.closeAll();
		store.closeAll();
		expect(closed).toEqual(["first", "second"]);
		expect(store.getSnapshot().layers).toEqual([]);
	});

	test("layers keep opening order so the last one is topmost", () => {
		const store = createOverlayStore();
		const a = store.open({ kind: "modal", render });
		const b = store.open({ kind: "anchored", render });
		expect(store.getSnapshot().layers.map((entry) => entry.id)).toEqual([a.id, b.id]);
	});

	test("update replaces layer fields but keeps id, kind and onClose", () => {
		const store = createOverlayStore();
		const closed: string[] = [];
		const handle = store.open({
			kind: "anchored",
			render,
			placement: "bottom-start",
			onClose: () => closed.push("x"),
		});
		let notified = 0;
		store.subscribe(() => {
			notified++;
		});
		const nextRender = () => "next";
		store.update(handle.id, { render: nextRender, placement: "top-end" });
		const [entry] = store.getSnapshot().layers;
		expect(entry?.render).toBe(nextRender);
		expect(entry?.placement).toBe("top-end");
		expect(entry?.kind).toBe("anchored");
		expect(entry?.id).toBe(handle.id);
		store.update(999, { placement: "top-start" });
		expect(notified).toBe(1);
		handle.close();
		expect(closed).toEqual(["x"]);
	});
});
