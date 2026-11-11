// The split controller: the plugin-level store of the layout and every action on it. It talks to
// the host only through `HostPorts`, so the rules are testable without a browser.
//
// Host rules this file encodes (docs/remix/dsh-split/spike.md, lane-c-dsh-internals.md):
// - The active pane's Session is the host's main Session: activating a pane calls
//   `openSession`, which moves the right sidebar to that Session.
// - A Session is shown in at most one pane (one editor per Session).
// - Nothing here retains a Session; panes retain in their own mount effect.

import type { DropZone } from "../layout/drop.ts";
import { bestSide, fitLayout, type Surface } from "../layout/fit.ts";
import { parseLayout, serializeLayout } from "../layout/storage.ts";
import {
	assignSession,
	balanceAll,
	balanceRun,
	closePane,
	cyclePane,
	findPane,
	focusPane,
	type LayoutState,
	leaf,
	MAX_PANES,
	movePane,
	type PaneId,
	type PaneLeaf,
	type PaneNode,
	paneCount,
	paneOfSession,
	panes,
	type SessionId,
	type Side,
	type SplitAxis,
	setRatioAt,
	sideAxis,
	sideLeads,
	split,
	splitPane,
	swapPanes,
} from "../layout/tree.ts";
import type { DragPayload } from "./drag.ts";

/** Choice a pane's home surface hands to the host when it starts a conversation. */
export interface NewSessionOptions {
	readonly workspaceId?: string;
	/** Directory to register as a Workspace when no Workspace id is chosen. */
	readonly path?: string;
	readonly agentPreset?: string;
}

export interface HostPorts {
	/** Make a Session the host's main Session. */
	openSession(sessionId: SessionId): void;
	/** The host's main Session, if any. */
	mainSession(): SessionId | undefined;
	/**
	 * Create a Session for a new conversation. Without explicit options it joins `near`'s
	 * Workspace, else its directory; a home surface passes the chosen Workspace, mode or path.
	 */
	createSession(
		near: SessionId | undefined,
		options?: NewSessionOptions,
	): Promise<SessionId>;
	/** Tell the user a new conversation could not be created. */
	createFailed(error: unknown): void;
	/** Tell the user the layout already holds the most panes it may. */
	paneLimit(): void;
	/** Size of the surface the panes share (the main conversation's box), when on screen. */
	surfaceSize(): Surface | undefined;
	/** Replace the main conversation with the split placeholder. */
	enterSplit(): void;
	/** Restore the shipped main conversation. */
	leaveSplit(): void;
	readStorage(): string | null;
	writeStorage(value: string | null): void;
	/** Move keyboard focus into a pane once it has rendered. */
	focusPaneElement(id: PaneId): void;
	newPaneId(): PaneId;
	schedule(run: () => void, ms: number): () => void;
}

/** Where a drag is released: a pane, or the main conversation while no split is open. */
export type DropTarget =
	| { readonly kind: "pane"; readonly paneId: PaneId }
	| { readonly kind: "main" };

/** What a drop adds to the layout. */
export type DropContent = Exclude<DragPayload, { readonly kind: "pane" }>;

/** What a drop does; planned for the preview while dragging and planned again on release. */
export type DropPlan =
	/** Exchange the places of a shown pane and the target. */
	| { readonly kind: "swap"; readonly moving: PaneId; readonly target: PaneId }
	/** Move a shown pane to one side of the target. */
	| { readonly kind: "move"; readonly moving: PaneId; readonly target: PaneId; readonly side: Side }
	/** Show a Session in the target pane. */
	| { readonly kind: "assign"; readonly target: PaneId; readonly sessionId: SessionId }
	/** Start a new conversation in the target pane. */
	| { readonly kind: "create"; readonly target: PaneId }
	/** Add a pane on one side of the target. */
	| {
			readonly kind: "insert";
			readonly target: PaneId;
			readonly side: Side;
			readonly content: DropContent;
	  }
	/** Without a split: make a Session the main Session. */
	| { readonly kind: "open"; readonly sessionId: SessionId }
	/** Without a split: start a new conversation as the main Session. */
	| { readonly kind: "openNew" }
	/** Without a split: open the split with the main conversation and one more pane. */
	| { readonly kind: "splitMain"; readonly side: Side; readonly content: DropContent }
	/** The layout is full and the drop can do nothing. */
	| { readonly kind: "full" };

/** The part of the target a plan covers: one side, or all of it. */
export function planZone(plan: DropPlan): DropZone {
	return plan.kind === "move" || plan.kind === "insert" || plan.kind === "splitMain"
		? plan.side
		: "center";
}

/** Transient presentation state; never persisted. */
export interface SplitView {
	/** Panes waiting for a new Session. */
	readonly creating: ReadonlySet<PaneId>;
	/** The focused pane fills the split and the others sit behind a tab strip. */
	readonly zoomed: boolean;
}

export interface SplitController {
	getSnapshot(): LayoutState | null;
	getView(): SplitView;
	subscribe(listener: () => void): () => void;
	/** Open a Session beside the active one, or focus its pane when it is already shown. */
	openInSplit(sessionId: SessionId | undefined, axis?: SplitAxis): void;
	/** Add a pane beside the active pane; with no Session the new pane shows its home surface. */
	splitActive(axis: SplitAxis): void;
	/**
	 * Open a new conversation beside a pane (the focused one by default), or beside the main one.
	 * Without a side, the new pane goes right while the panes still fit, else below.
	 */
	newBeside(id: PaneId | undefined, side?: Side): void;
	closePane(id: PaneId): void;
	exit(): void;
	/** The user moved into a pane (pointer or focus). */
	activate(id: PaneId): void;
	/** Activate a pane and move keyboard focus into it. */
	select(id: PaneId): void;
	/** Keyboard pane switching: activate and move focus. */
	focusStep(delta: number): void;
	assign(id: PaneId, sessionId: SessionId): void;
	createIn(id: PaneId): Promise<void>;
	/** Start the conversation a pane's home surface chose, beside that pane's Session. */
	startIn(id: PaneId, options: NewSessionOptions): Promise<void>;
	setRatio(path: readonly number[], ratio: number): void;
	/** Give every pane of the divider's run the same share. */
	balance(path: readonly number[]): void;
	/** Give every split an even share, then move dividers as far as every card needs. */
	balanceAll(): void;
	toggleZoom(): void;
	/** Whether another pane fits under the pane limit. */
	canAddPane(): boolean;
	planDrop(target: DropTarget, payload: DragPayload, zone: DropZone): DropPlan | null;
	drop(target: DropTarget, payload: DragPayload, zone: DropZone): void;
	/** The host's main Session changed (left sidebar navigation, child links, reload). */
	mainChanged(sessionId: SessionId | undefined): void;
	/** The host Session list changed; `known` holds every listed Session. */
	sessionsChanged(known: ReadonlySet<SessionId>): void;
	/** Restore the stored layout once the Session list is ready. */
	restore(known: ReadonlySet<SessionId>): void;
	dispose(): void;
}

/** Delay before a layout change is written to storage (ratio drags write often). */
const PERSIST_DELAY_MS = 250;

const EMPTY_VIEW: SplitView = { creating: new Set(), zoomed: false };

const sessionOf = (content: DropContent): SessionId | undefined =>
	content.kind === "session" ? content.sessionId : undefined;

export function createSplitController(host: HostPorts): SplitController {
	let state: LayoutState | null = null;
	let view: SplitView = EMPTY_VIEW;
	let previousKnown: ReadonlySet<SessionId> | undefined;
	/** The Session this controller last asked the host to open, until the host reports it. */
	let opened: SessionId | undefined;
	let cancelPersist: (() => void) | undefined;
	const listeners = new Set<() => void>();

	const notify = (): void => {
		for (const listener of listeners) listener();
	};

	const persist = (): void => {
		cancelPersist?.();
		cancelPersist = host.schedule(() => {
			cancelPersist = undefined;
			host.writeStorage(state === null ? null : serializeLayout(state));
		}, PERSIST_DELAY_MS);
	};

	const set = (next: LayoutState | null): void => {
		if (next === state) return;
		const entering = state === null && next !== null;
		const leaving = state !== null && next === null;
		// A pane that appears should be seen, so a zoom ends when the split grows or closes.
		const grew = state !== null && next !== null && paneCount(next.root) > paneCount(state.root);
		if (view.zoomed && (next === null || grew)) view = { ...view, zoomed: false };
		state = next;
		if (entering) host.enterSplit();
		if (leaving) host.leaveSplit();
		persist();
		notify();
	};

	const markCreating = (id: PaneId, creating: boolean): void => {
		const next = new Set(view.creating);
		if (creating) next.add(id);
		else next.delete(id);
		view = { ...view, creating: next };
		notify();
	};

	/** Ask the host to show a Session as main; its report of that Session is not navigation. */
	const openMain = (sessionId: SessionId): void => {
		opened = sessionId;
		host.openSession(sessionId);
	};

	/** Point the host's main Session at the focused pane, when it shows one. */
	const followFocus = (): void => {
		if (state === null) return;
		const sessionId = findPane(state.root, state.focus)?.sessionId;
		if (sessionId !== undefined && sessionId !== host.mainSession()) openMain(sessionId);
	};

	const activate = (id: PaneId): void => {
		if (state === null || state.focus === id) return;
		const next = focusPane(state, id);
		if (next === state) return;
		set(next);
		followFocus();
	};

	/** The tree with its dividers moved as far as every card needs, when that is possible. */
	const fitted = (root: PaneNode): PaneNode => {
		const surface = host.surfaceSize();
		return surface === undefined ? root : (fitLayout(root, surface) ?? root);
	};

	/**
	 * Commit a changed tree with `focus` focused, followed by the main Session and the keyboard.
	 * A pane placed where shares no longer leave every card its minimum takes room from its
	 * neighbours instead of dropping the split to one pane at a time.
	 */
	const settle = (root: PaneNode, focus: PaneId): void => {
		if (state === null) return;
		set(focusPane({ ...state, root: fitted(root) }, focus));
		followFocus();
		host.focusPaneElement(focus);
	};

	const assign = (id: PaneId, sessionId: SessionId): void => {
		if (state === null || findPane(state.root, id) === undefined) return;
		const shown = paneOfSession(state.root, sessionId);
		if (shown !== undefined && shown !== id) {
			activate(shown);
			host.focusPaneElement(shown);
			return;
		}
		settle(assignSession(state.root, id, sessionId), id);
	};

	/** The Session a new conversation for a pane is created beside: the pane's own, else main. */
	const nearPane = (id: PaneId): SessionId | undefined =>
		(state === null ? undefined : findPane(state.root, id)?.sessionId) ?? host.mainSession();

	/**
	 * Create a Session for a pane. The result lands only if the pane still shows what it showed
	 * when the request started: a pane closed or given another Session meanwhile is left alone.
	 */
	const createInto = (
		id: PaneId,
		near: SessionId | undefined,
		options?: NewSessionOptions,
	): void => {
		const before = state === null ? undefined : findPane(state.root, id)?.sessionId;
		markCreating(id, true);
		host.createSession(near, options).then(
			(sessionId) => {
				markCreating(id, false);
				const pane = state === null ? undefined : findPane(state.root, id);
				if (pane !== undefined && pane.sessionId === before) assign(id, sessionId);
			},
			(error: unknown) => {
				markCreating(id, false);
				host.createFailed(error);
			},
		);
	};

	/** Add a pane on one side of `target` and focus it. */
	const place = (target: PaneId, side: Side, added: PaneLeaf): boolean => {
		if (state === null) return false;
		if (paneCount(state.root) >= MAX_PANES) {
			host.paneLimit();
			return false;
		}
		const root = splitPane(state.root, target, sideAxis(side), added, sideLeads(side));
		if (root === undefined) return false;
		settle(root, added.id);
		return true;
	};

	/** Open the split with the main Session and a new pane on `side` of it, focused. */
	const openAround = (
		main: SessionId | undefined,
		side: Side,
		sessionId: SessionId | undefined,
	): PaneId => {
		const first = leaf(host.newPaneId(), main);
		const added = leaf(host.newPaneId(), sessionId);
		const axis = sideAxis(side);
		set({
			root: sideLeads(side) ? split(axis, added, first) : split(axis, first, added),
			focus: added.id,
			previous: first.id,
		});
		followFocus();
		host.focusPaneElement(added.id);
		return added.id;
	};

	const planOnPane = (
		target: PaneId,
		payload: DragPayload,
		requested: DropZone,
	): DropPlan | null => {
		if (state === null || findPane(state.root, target) === undefined) return null;
		if (payload.kind === "pane" || payload.kind === "session") {
			const moving =
				payload.kind === "pane"
					? findPane(state.root, payload.paneId)?.id
					: paneOfSession(state.root, payload.sessionId);
			if (moving !== undefined) {
				if (moving === target) return null;
				return requested === "center"
					? { kind: "swap", moving, target }
					: { kind: "move", moving, target, side: requested };
			}
			if (payload.kind === "pane") return null;
		}
		// A full layout takes no new pane: an edge drop falls back to the centre.
		const full = paneCount(state.root) >= MAX_PANES;
		const zone = full ? "center" : requested;
		if (zone !== "center") return { kind: "insert", target, side: zone, content: payload };
		if (payload.kind === "session") return { kind: "assign", target, sessionId: payload.sessionId };
		if (payload.kind === "new") return { kind: "create", target };
		return full ? { kind: "full" } : null;
	};

	const planOnMain = (payload: DragPayload, requested: DropZone): DropPlan | null => {
		if (state !== null || payload.kind === "pane") return null;
		const main = host.mainSession();
		if (payload.kind === "session" && payload.sessionId === main) return null;
		// Without a main Session there is nothing to split beside.
		const zone = main === undefined ? "center" : requested;
		if (zone !== "center") return { kind: "splitMain", side: zone, content: payload };
		if (payload.kind === "session") return { kind: "open", sessionId: payload.sessionId };
		if (payload.kind === "new") return { kind: "openNew" };
		return null;
	};

	const planDrop = (target: DropTarget, payload: DragPayload, zone: DropZone): DropPlan | null =>
		target.kind === "main" ? planOnMain(payload, zone) : planOnPane(target.paneId, payload, zone);

	const execute = (plan: DropPlan): void => {
		switch (plan.kind) {
			case "swap": {
				const root = state === null ? undefined : swapPanes(state.root, plan.moving, plan.target);
				if (root !== undefined) settle(root, plan.moving);
				return;
			}
			case "move": {
				const root =
					state === null ? undefined : movePane(state.root, plan.moving, plan.target, plan.side);
				if (root !== undefined) settle(root, plan.moving);
				return;
			}
			case "assign":
				assign(plan.target, plan.sessionId);
				return;
			case "create":
				createInto(plan.target, nearPane(plan.target));
				return;
			case "insert": {
				const added = leaf(host.newPaneId(), sessionOf(plan.content));
				const near = nearPane(plan.target);
				if (place(plan.target, plan.side, added) && plan.content.kind === "new")
					createInto(added.id, near);
				return;
			}
			case "open":
				openMain(plan.sessionId);
				return;
			case "openNew":
				host.createSession(host.mainSession()).then(
					(sessionId) => openMain(sessionId),
					(error: unknown) => host.createFailed(error),
				);
				return;
			case "splitMain": {
				const main = host.mainSession();
				const added = openAround(main, plan.side, sessionOf(plan.content));
				if (plan.content.kind === "new") createInto(added, main);
				return;
			}
			case "full":
				host.paneLimit();
				return;
		}
	};

	/** Open the split around the main Session with a second pane; the picker when none is given. */
	const open = (sessionId: SessionId | undefined, axis: SplitAxis): void => {
		const main = host.mainSession();
		// Without a main Session (another main panel is active) only an explicit Session opens.
		if (main === undefined && sessionId === undefined) return;
		const second = main === undefined || sessionId === main ? undefined : sessionId;
		openAround(main ?? sessionId, axis === "row" ? "right" : "bottom", second);
	};

	return {
		getSnapshot: () => state,
		getView: () => view,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},

		openInSplit(sessionId, axis = "row") {
			if (state === null) {
				open(sessionId, axis);
				return;
			}
			const shown = sessionId === undefined ? undefined : paneOfSession(state.root, sessionId);
			if (shown !== undefined) {
				activate(shown);
				host.focusPaneElement(shown);
				return;
			}
			place(state.focus, axis === "row" ? "right" : "bottom", leaf(host.newPaneId(), sessionId));
		},

		splitActive(axis) {
			if (state === null) open(undefined, axis);
			else place(state.focus, axis === "row" ? "right" : "bottom", leaf(host.newPaneId()));
		},

		newBeside(id, side) {
			const surface = host.surfaceSize();
			if (state === null) {
				const main = leaf("main");
				const chosen = side ?? (surface === undefined ? "right" : bestSide(main, main.id, surface));
				const plan = planOnMain({ kind: "new" }, chosen);
				if (plan !== null) execute(plan);
				return;
			}
			const target = id ?? state.focus;
			const chosen =
				side ?? (surface === undefined ? "right" : bestSide(state.root, target, surface));
			const added = leaf(host.newPaneId());
			const near = nearPane(target);
			if (place(target, chosen, added)) createInto(added.id, near);
		},

		closePane(id) {
			if (state === null) return;
			if (paneCount(state.root) <= 2) {
				const other = panes(state.root).find((pane) => pane.id !== id);
				set(null);
				if (other?.sessionId !== undefined && other.sessionId !== host.mainSession())
					openMain(other.sessionId);
				return;
			}
			const focusBefore = state.focus;
			const next = closePane(state, id);
			if (next === undefined) return;
			set(next);
			if (next.focus !== focusBefore) {
				followFocus();
				host.focusPaneElement(next.focus);
			}
		},

		exit() {
			set(null);
		},

		activate,

		select(id) {
			if (state === null || findPane(state.root, id) === undefined) return;
			activate(id);
			host.focusPaneElement(id);
		},

		focusStep(delta) {
			if (state === null) return;
			const id = cyclePane(state, delta);
			activate(id);
			host.focusPaneElement(id);
		},

		assign,

		startIn(id, options) {
			createInto(id, nearPane(id), options);
			return Promise.resolve();
		},

		async createIn(id) {
			if (state === null) return;
			const focused = findPane(state.root, state.focus)?.sessionId;
			const near =
				findPane(state.root, id)?.sessionId ??
				focused ??
				panes(state.root).find((pane) => pane.sessionId !== undefined)?.sessionId;
			const sessionId = await host.createSession(near);
			// The picker may have been answered by a drop while the Session was being created.
			if (state !== null && findPane(state.root, id)?.sessionId === undefined)
				assign(id, sessionId);
		},

		setRatio(path, ratio) {
			if (state === null) return;
			const root = setRatioAt(state.root, path, ratio);
			if (root !== state.root) set({ ...state, root });
		},

		balance(path) {
			if (state === null) return;
			const root = balanceRun(state.root, path);
			if (root !== state.root) set({ ...state, root });
		},

		balanceAll() {
			if (state === null) return;
			const root = fitted(balanceAll(state.root));
			if (root !== state.root) set({ ...state, root });
		},

		toggleZoom() {
			if (state === null) return;
			view = { ...view, zoomed: !view.zoomed };
			notify();
		},

		canAddPane: () => state === null || paneCount(state.root) < MAX_PANES,

		planDrop,

		drop(target, payload, zone) {
			const plan = planDrop(target, payload, zone);
			if (plan !== null) execute(plan);
		},

		mainChanged(sessionId) {
			// The host reporting a Session this controller opened is no navigation: the focus may have
			// moved on since (a pane split beside the one that opened it), and must stay there.
			const echo = sessionId !== undefined && sessionId === opened;
			opened = undefined;
			if (echo || state === null || sessionId === undefined) return;
			const shown = paneOfSession(state.root, sessionId);
			if (shown !== undefined) {
				if (shown !== state.focus) set(focusPane(state, shown));
				return;
			}
			set({ ...state, root: assignSession(state.root, state.focus, sessionId) });
		},

		sessionsChanged(known) {
			const before = previousKnown;
			previousKnown = known;
			if (state === null || before === undefined) return;
			let root = state.root;
			for (const pane of panes(root)) {
				const id = pane.sessionId;
				if (id !== undefined && before.has(id) && !known.has(id))
					root = assignSession(root, pane.id, undefined);
			}
			if (root !== state.root) set({ ...state, root });
		},

		restore(known) {
			previousKnown = known;
			if (state !== null) return;
			const restored = parseLayout(host.readStorage(), known);
			if (restored === undefined) return;
			set(restored);
			followFocus();
			// The host focuses the last composer that mounts; move the keyboard to the focused pane.
			host.focusPaneElement(restored.focus);
		},

		dispose() {
			cancelPersist?.();
			cancelPersist = undefined;
			listeners.clear();
		},
	};
}
