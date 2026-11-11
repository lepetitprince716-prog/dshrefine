import { describe, expect, it } from "bun:test";
import { fitScore } from "../layout/fit.ts";
import { type LayoutState, nodeAt, type PaneSplit, panes, pathOf } from "../layout/tree.ts";
import { createSplitController, type HostPorts } from "./controller.ts";

interface FakeHost extends HostPorts {
	main: string | undefined;
	surface: { width: number; height: number } | undefined;
	stored: string | null;
	readonly opened: string[];
	readonly focused: string[];
	readonly events: string[];
	readonly timers: (() => void)[];
	flush(): void;
}

function fakeHost(main = "s1"): FakeHost {
	let next = 0;
	const host: FakeHost = {
		main,
		surface: undefined,
		stored: null,
		opened: [],
		focused: [],
		events: [],
		timers: [],
		openSession(sessionId) {
			host.opened.push(sessionId);
			host.main = sessionId;
		},
		mainSession: () => host.main,
		createSession: async () => "created",
		createFailed: () => host.events.push("createFailed"),
		pickFolder: async () => null,
		paneLimit: () => host.events.push("paneLimit"),
		surfaceSize: () => host.surface,
		enterSplit: () => host.events.push("enter"),
		leaveSplit: () => host.events.push("leave"),
		readStorage: () => host.stored,
		writeStorage(value) {
			host.stored = value;
		},
		focusPaneElement: (id) => host.focused.push(id),
		newPaneId: () => `p${next++}`,
		schedule(run) {
			host.timers.push(run);
			return () => {
				const index = host.timers.indexOf(run);
				if (index >= 0) host.timers.splice(index, 1);
			};
		},
		flush() {
			for (const run of host.timers.splice(0)) run();
		},
	};
	return host;
}

const sessionsOf = (state: LayoutState | null) =>
	state === null ? [] : panes(state.root).map((pane) => pane.sessionId);
const paneIdsOf = (state: LayoutState | null) =>
	state === null ? [] : panes(state.root).map((pane) => pane.id);

interface PendingCreates {
	/** The `near` argument of every request, in order. */
	readonly nears: (string | undefined)[];
	resolve(sessionId: string): void;
	reject(error: unknown): void;
}

/** Hold every `createSession` request until the test settles it. */
function holdCreates(host: FakeHost): PendingCreates {
	const waiting: { resolve: (id: string) => void; reject: (error: unknown) => void }[] = [];
	const pending: PendingCreates = {
		nears: [],
		resolve: (sessionId) => waiting.shift()?.resolve(sessionId),
		reject: (error) => waiting.shift()?.reject(error),
	};
	host.createSession = (near) => {
		pending.nears.push(near);
		return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
	};
	return pending;
}

/** Let settled promises run their callbacks. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A split of eight panes: s1, s2 and six pickers. */
function fullSplit(host: FakeHost) {
	const controller = createSplitController(host);
	controller.openInSplit("s2");
	for (let index = 0; index < 6; index++) controller.splitActive("row");
	return controller;
}

describe("opening a split", () => {
	it("puts the main Session first and the opened one second, focused and made main", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		const state = controller.getSnapshot();
		expect(sessionsOf(state)).toEqual(["s1", "s2"]);
		expect(state?.focus).toBe("p1");
		expect(host.events).toEqual(["enter"]);
		expect(host.opened).toEqual(["s2"]);
		expect(host.focused).toEqual(["p1"]);
	});

	it("opens the main Session beside an empty picker pane", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s1");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined]);
		expect(host.opened).toEqual([]);
	});

	it("does nothing without a main Session or an explicit one", () => {
		const host = fakeHost();
		host.main = undefined;
		const controller = createSplitController(host);
		controller.splitActive("row");
		expect(controller.getSnapshot()).toBeNull();
		expect(host.events).toEqual([]);
	});

	it("focuses the existing pane instead of showing a Session twice", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.openInSplit("s1");
		const state = controller.getSnapshot();
		expect(sessionsOf(state)).toEqual(["s1", "s2"]);
		expect(state?.focus).toBe("p0");
		expect(host.opened).toEqual(["s2", "s1"]);
	});

	it("splits the active pane for a further Session", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.openInSplit("s3", "column");
		const state = controller.getSnapshot();
		expect(sessionsOf(state)).toEqual(["s1", "s2", "s3"]);
		expect(state?.root).toMatchObject({ second: { kind: "split", axis: "column" } });
		expect(state?.focus).toBe("p2");
		expect(state?.previous).toBe("p1");
	});
});

describe("activation and the main Session", () => {
	it("makes the activated pane's Session main, once", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.activate("p0");
		controller.activate("p0");
		expect(host.opened).toEqual(["s2", "s1"]);
	});

	it("activating an empty pane leaves the main Session alone", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.splitActive("row");
		controller.activate("p0");
		controller.activate("p1");
		expect(host.opened).toEqual([]);
		expect(controller.getSnapshot()?.focus).toBe("p1");
	});

	it("follows navigation: a shown Session focuses its pane, another fills the active pane", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.mainChanged("s1");
		expect(controller.getSnapshot()?.focus).toBe("p0");
		controller.mainChanged("s9");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s9", "s2"]);
		controller.mainChanged(undefined);
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s9", "s2"]);
	});

	it("takes the host's report of a Session it opened itself as no navigation", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.mainChanged("s2");
		expect(controller.getSnapshot()?.focus).toBe("p1");
		// Splitting a pane activates it first, which opens its Session; the report comes later.
		controller.activate("p0");
		controller.splitActive("column");
		expect(host.opened).toEqual(["s2", "s1"]);
		controller.mainChanged("s1");
		expect(controller.getSnapshot()?.focus).toBe("p2");
		controller.mainChanged("s2");
		expect(controller.getSnapshot()?.focus).toBe("p1");
	});

	it("ignores navigation while no split is open", () => {
		const controller = createSplitController(fakeHost());
		controller.mainChanged("s2");
		expect(controller.getSnapshot()).toBeNull();
	});
});

describe("closing", () => {
	it("closing one of two panes leaves the split with the other pane's Session as main", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.closePane("p1");
		expect(controller.getSnapshot()).toBeNull();
		expect(host.events).toEqual(["enter", "leave"]);
		expect(host.main).toBe("s1");
	});

	it("closing the focused pane of three returns focus to the pane it came from", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.activate("p0");
		controller.openInSplit("s3");
		controller.closePane("p2");
		const state = controller.getSnapshot();
		expect(state?.focus).toBe("p0");
		expect(sessionsOf(state)).toEqual(["s1", "s2"]);
		expect(host.main).toBe("s1");
		expect(host.focused.at(-1)).toBe("p0");
	});

	it("exit restores the shipped view and clears storage", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		host.flush();
		expect(host.stored).not.toBeNull();
		controller.exit();
		host.flush();
		expect(host.events).toEqual(["enter", "leave"]);
		expect(host.stored).toBeNull();
	});
});

describe("picker panes", () => {
	it("assigns a picked Session and makes it main", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.splitActive("row");
		controller.assign("p1", "s3");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", "s3"]);
		expect(host.opened).toEqual(["s3"]);
	});

	it("a picked Session already shown focuses its pane instead", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.splitActive("row");
		controller.assign("p1", "s1");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined]);
		expect(controller.getSnapshot()?.focus).toBe("p0");
	});
});

describe("Session list and storage", () => {
	it("empties a pane whose Session left the list, but not one not yet listed", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.restore(new Set(["s1", "s2"]));
		controller.openInSplit("s2");
		controller.openInSplit("s3");
		controller.sessionsChanged(new Set(["s1"]));
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined, "s3"]);
	});

	it("restores a stored layout and makes its focused Session main", () => {
		const first = fakeHost("s1");
		const writer = createSplitController(first);
		writer.openInSplit("s2");
		writer.activate("p0");
		first.flush();

		const host = fakeHost("s2");
		host.stored = first.stored;
		const controller = createSplitController(host);
		controller.restore(new Set(["s1", "s2"]));
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", "s2"]);
		expect(host.events).toEqual(["enter"]);
		expect(host.opened).toEqual(["s1"]);
		expect(host.focused).toEqual(["p0"]);
	});

	it("restores nothing when the stored Sessions are gone", () => {
		const first = fakeHost("s1");
		const writer = createSplitController(first);
		writer.openInSplit("s2");
		first.flush();
		const host = fakeHost("s1");
		host.stored = first.stored;
		const controller = createSplitController(host);
		controller.restore(new Set(["s1"]));
		expect(controller.getSnapshot()).toBeNull();
	});

	it("debounces writes while a divider is dragged", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		for (const ratio of [0.4, 0.35, 0.3]) controller.setRatio([], ratio);
		expect(host.timers.length).toBe(1);
		host.flush();
		expect(JSON.parse(host.stored ?? "{}").root.ratio).toBe(0.3);
	});
});

describe("dropping onto a pane", () => {
	it("opens a dragged Session on the side it is dropped, focused and main", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.drop({ kind: "pane", paneId: "p0" }, { kind: "session", sessionId: "s3" }, "bottom");
		const state = controller.getSnapshot();
		expect(sessionsOf(state)).toEqual(["s1", "s3", "s2"]);
		expect(state?.root).toMatchObject({ axis: "row", first: { kind: "split", axis: "column" } });
		expect(state?.focus).toBe("p2");
		expect(host.main).toBe("s3");
		expect(host.focused.at(-1)).toBe("p2");
	});

	it("shows a Session dropped on a pane's centre in that pane", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.drop({ kind: "pane", paneId: "p0" }, { kind: "session", sessionId: "s3" }, "center");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s3", "s2"]);
		expect(controller.getSnapshot()?.focus).toBe("p0");
		expect(host.main).toBe("s3");
	});

	it("swaps a shown Session on the centre and moves a pane on an edge, keeping pane ids", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.openInSplit("s3");
		controller.drop({ kind: "pane", paneId: "p0" }, { kind: "session", sessionId: "s3" }, "center");
		let state = controller.getSnapshot();
		expect(paneIdsOf(state)).toEqual(["p2", "p1", "p0"]);
		expect(sessionsOf(state)).toEqual(["s3", "s2", "s1"]);
		expect(state?.focus).toBe("p2");

		controller.drop({ kind: "pane", paneId: "p1" }, { kind: "pane", paneId: "p0" }, "top");
		state = controller.getSnapshot();
		expect(paneIdsOf(state)).toEqual(["p2", "p0", "p1"]);
		expect(state?.root).toMatchObject({ axis: "row", second: { kind: "split", axis: "column" } });
		expect(state?.focus).toBe("p0");
		expect(host.main).toBe("s1");
	});

	it("plans nothing for a pane or its Session dropped onto itself", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		const target = { kind: "pane", paneId: "p1" } as const;
		expect(controller.planDrop(target, { kind: "pane", paneId: "p1" }, "left")).toBeNull();
		expect(controller.planDrop(target, { kind: "session", sessionId: "s2" }, "center")).toBeNull();
		expect(controller.planDrop(target, { kind: "pane", paneId: "gone" }, "left")).toBeNull();
	});

	it("adds an empty pane for a new conversation dropped on an edge", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.drop({ kind: "pane", paneId: "p0" }, { kind: "new" }, "right");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined, "s2"]);
		expect(controller.getSnapshot()?.focus).toBe("p2");
		expect(controller.getView().creating.size).toBe(0);
		// The home surface creates the conversation only when it is answered.
		await settled();
		expect(pending.nears).toEqual([]);
	});

	it("empties a pane whose Session was replaced by a new conversation on its centre", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.drop({ kind: "pane", paneId: "p0" }, { kind: "new" }, "center");
		expect(sessionsOf(controller.getSnapshot())).toEqual([undefined, "s2"]);
		expect(controller.getSnapshot()?.focus).toBe("p0");
		await settled();
		expect(pending.nears).toEqual([]);
	});

	it("drops a started Session whose pane was closed or filled meanwhile", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.splitActive("row");
		controller.splitActive("row");
		controller.startIn("p2", { path: "/work/new" });
		controller.startIn("p3", { path: "/work/other" });
		controller.closePane("p2");
		controller.assign("p3", "s5");
		pending.resolve("s8");
		pending.resolve("s9");
		await settled();
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", "s2", "s5"]);
		expect(host.opened).not.toContain("s8");
		expect(host.opened).not.toContain("s9");
	});

	it("reports a failed creation and leaves the home surface in place", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.splitActive("row");
		controller.startIn("p2", { path: "/work/new" });
		pending.reject(new Error("offline"));
		await settled();
		expect(host.events).toContain("createFailed");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", "s2", undefined]);
		expect(controller.getView().creating.size).toBe(0);
	});

	it("adds a picker pane on an edge drop of an empty pane, never on the centre", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		const target = { kind: "pane", paneId: "p0" } as const;
		expect(controller.planDrop(target, { kind: "empty" }, "center")).toBeNull();
		controller.drop(target, { kind: "empty" }, "top");
		expect(sessionsOf(controller.getSnapshot())).toEqual([undefined, "s1", "s2"]);
		expect(controller.getSnapshot()?.focus).toBe("p2");
	});

	it("empties the target pane for a new conversation dropped on its centre", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.drop({ kind: "pane", paneId: "p1" }, { kind: "new" }, "center");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined]);
		expect(controller.getSnapshot()?.focus).toBe("p1");
	});

	it("turns edge drops into replacements once eight panes are open", () => {
		const host = fakeHost("s1");
		const controller = fullSplit(host);
		const target = { kind: "pane", paneId: "p0" } as const;
		expect(paneIdsOf(controller.getSnapshot())).toHaveLength(8);
		expect(controller.canAddPane()).toBe(false);
		expect(controller.planDrop(target, { kind: "session", sessionId: "s5" }, "left")).toEqual({
			kind: "assign",
			target: "p0",
			sessionId: "s5",
		});
		expect(controller.planDrop(target, { kind: "new" }, "left")).toEqual({
			kind: "create",
			target: "p0",
		});
		expect(controller.planDrop(target, { kind: "pane", paneId: "p1" }, "left")).toMatchObject({
			kind: "move",
		});
		expect(controller.planDrop(target, { kind: "empty" }, "left")).toEqual({ kind: "full" });
		controller.drop(target, { kind: "empty" }, "left");
		controller.splitActive("row");
		controller.newBeside(undefined);
		expect(host.events.filter((event) => event === "paneLimit")).toHaveLength(3);
		expect(paneIdsOf(controller.getSnapshot())).toHaveLength(8);
	});
});

describe("dropping onto the main conversation", () => {
	it("opens the split with the dragged Session on the side it is dropped", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.drop({ kind: "main" }, { kind: "session", sessionId: "s2" }, "left");
		const state = controller.getSnapshot();
		expect(sessionsOf(state)).toEqual(["s2", "s1"]);
		expect(state?.focus).toBe("p1");
		expect(host.events).toEqual(["enter"]);
		expect(host.main).toBe("s2");
	});

	it("opens a Session dropped on the centre without a split", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.drop({ kind: "main" }, { kind: "session", sessionId: "s2" }, "center");
		expect(controller.getSnapshot()).toBeNull();
		expect(host.opened).toEqual(["s2"]);
	});

	it("plans nothing for the main Session itself or a pane", () => {
		const controller = createSplitController(fakeHost("s1"));
		const main = { kind: "main" } as const;
		expect(controller.planDrop(main, { kind: "session", sessionId: "s1" }, "right")).toBeNull();
		expect(controller.planDrop(main, { kind: "pane", paneId: "p0" }, "right")).toBeNull();
		expect(controller.planDrop(main, { kind: "empty" }, "center")).toBeNull();
	});

	it("opens a new pane beside the main one and leaves the project choice to it", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.drop({ kind: "main" }, { kind: "new" }, "right");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined]);
		expect(controller.getView().creating.size).toBe(0);
		await settled();
		expect(pending.nears).toEqual([]);
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined]);
	});

	it("opens a new conversation dropped on the centre as the main Session", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.drop({ kind: "main" }, { kind: "new" }, "center");
		pending.resolve("s9");
		await settled();
		expect(controller.getSnapshot()).toBeNull();
		expect(host.opened).toEqual(["s9"]);
	});

	it("opens a dragged Session without a split when there is no main Session", () => {
		const host = fakeHost();
		host.main = undefined;
		const controller = createSplitController(host);
		expect(
			controller.planDrop({ kind: "main" }, { kind: "session", sessionId: "s2" }, "right"),
		).toEqual({
			kind: "open",
			sessionId: "s2",
		});
	});
});

describe("new conversations beside a pane", () => {
	it("opens the split with a home pane beside the main conversation without one", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.newBeside(undefined);
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined]);
		expect(controller.getSnapshot()?.focus).toBe("p1");
		await settled();
		expect(pending.nears).toEqual([]);
	});

	it("puts it right while the panes fit, else below", () => {
		const host = fakeHost("s1");
		holdCreates(host);
		host.surface = { width: 1160, height: 900 };
		const controller = createSplitController(host);
		for (let index = 0; index < 4; index++) controller.newBeside(undefined);
		const root = controller.getSnapshot()?.root;
		if (root === undefined) throw new Error("no split");
		const parentAxis = (id: string) =>
			(nodeAt(root, (pathOf(root, id) ?? []).slice(0, -1)) as PaneSplit).axis;
		expect(paneIdsOf(controller.getSnapshot())).toEqual(["p0", "p1", "p2", "p3", "p4"]);
		expect(parentAxis("p2")).toBe("row");
		expect(parentAxis("p4")).toBe("column");
	});

	it("opens one beside the given pane on the given side, on its home surface", async () => {
		const host = fakeHost("s1");
		const pending = holdCreates(host);
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.newBeside("p0", "bottom");
		expect(controller.getSnapshot()?.root).toMatchObject({
			first: { kind: "split", axis: "column" },
		});
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", undefined, "s2"]);
		expect(controller.getSnapshot()?.focus).toBe("p2");
		// Nothing is created until the home surface is answered.
		await settled();
		expect(pending.nears).toEqual([]);
		expect(controller.getView().creating.size).toBe(0);
	});

	it("remembers the Session a home pane split from as its default project", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		// A pane opened beside the second pane defaults to that pane's project...
		controller.newBeside("p1", "right");
		expect(controller.nearOf("p2")).toBe("s2");
		// ...and forgets it once a conversation fills the pane.
		controller.assign("p2", "s9");
		expect(controller.nearOf("p2")).toBeUndefined();
		// A conversation dropped on a pane's centre seeds the replacement from that Session.
		controller.drop({ kind: "pane", paneId: "p1" }, { kind: "new" }, "center");
		expect(controller.nearOf("p1")).toBe("s2");
	});
});

describe("zoom and balance", () => {
	it("zooms only while split, and a new pane or leaving the split ends the zoom", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.toggleZoom();
		expect(controller.getView().zoomed).toBe(false);
		controller.openInSplit("s2");
		controller.toggleZoom();
		expect(controller.getView().zoomed).toBe(true);
		controller.activate("p0");
		expect(controller.getView().zoomed).toBe(true);
		controller.splitActive("row");
		expect(controller.getView().zoomed).toBe(false);
		controller.toggleZoom();
		controller.exit();
		expect(controller.getView().zoomed).toBe(false);
	});

	it("evens a resized split again", () => {
		const host = fakeHost("s1");
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.setRatio([], 0.3);
		controller.balance([]);
		expect(controller.getSnapshot()?.root).toMatchObject({ ratio: 0.5 });
		controller.setRatio([], 0.2);
		controller.balanceAll();
		expect(controller.getSnapshot()?.root).toMatchObject({ ratio: 0.5 });
	});
});

describe("fitting the surface", () => {
	it("makes room for a pane dropped where even shares would not fit", () => {
		const host = fakeHost("s1");
		host.surface = { width: 1160, height: 900 };
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.drop({ kind: "pane", paneId: "p1" }, { kind: "session", sessionId: "s3" }, "bottom");
		controller.drop({ kind: "pane", paneId: "p2" }, { kind: "session", sessionId: "s4" }, "right");
		controller.drop({ kind: "pane", paneId: "p2" }, { kind: "session", sessionId: "s5" }, "right");
		const root = controller.getSnapshot()?.root;
		if (root === undefined) throw new Error("expected a split");
		expect(sessionsOf(controller.getSnapshot())).toEqual(["s1", "s2", "s3", "s5", "s4"]);
		expect(fitScore(root, host.surface)).toBeGreaterThanOrEqual(1);
		expect((root as PaneSplit).ratio).toBeLessThan(0.5);
	});

	it("evens out and makes room in one step", () => {
		const host = fakeHost("s1");
		host.surface = { width: 1160, height: 900 };
		const controller = createSplitController(host);
		controller.openInSplit("s2");
		controller.drop({ kind: "pane", paneId: "p1" }, { kind: "session", sessionId: "s3" }, "bottom");
		controller.drop({ kind: "pane", paneId: "p2" }, { kind: "session", sessionId: "s4" }, "right");
		controller.drop({ kind: "pane", paneId: "p2" }, { kind: "session", sessionId: "s5" }, "right");
		controller.setRatio([], 0.5);
		controller.balanceAll();
		const root = controller.getSnapshot()?.root;
		if (root === undefined) throw new Error("expected a split");
		expect(fitScore(root, host.surface)).toBeGreaterThanOrEqual(1);
	});
});
