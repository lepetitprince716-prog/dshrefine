// Browser module of @refine/split. While a split is open, a `main.conversation` shadow at
// priority -1 renders only a placeholder, and a root-scoped `shell.overlay` entry renders the
// panes over the placeholder's box (docs/remix/dsh-split/spike.md). Sidebar Session rows, the
// sidebar's New session button, the header's split button and the pane headers start drags that
// the overlay's drop surfaces turn into splits.
import { createOverlayStore, uiCss } from "@refine/ui";
import type {
	ClientContext,
	ClientWorkspaces,
	Disposer,
	SessionListState,
} from "../dsh-types.d.ts";
import { STORAGE_KEY } from "../layout/storage.ts";
import { createAnchorStore, SplitAnchor } from "./anchor.ts";
import { createSplitController, type HostPorts } from "./controller.ts";
import { createDragStore, measureCenterColumn, trackHostDrags } from "./drag.ts";
import { requestPaneFocus, trackKeyboardNavigation } from "./focus.ts";
import { NS, registerLocale, type Translate } from "./locale.ts";
import { SplitOverlay } from "./Overlay.tsx";
import type { PanePreset } from "./PaneHome.tsx";
import { PANE_SLOT, PaneBody } from "./PaneSession.tsx";
import { SessionMenuItem } from "./SessionMenuItem.tsx";
import { SplitButton } from "./SplitButton.tsx";
import { registerShortcuts } from "./shortcuts.ts";
import { PKG, SPLIT_ACTIVE_CSS, SPLIT_CSS } from "./styles.ts";

const OVERLAY_ID = "dsh-split";
const MENU_ITEM_ID = "dsh-split.open-in-split";
/** After the shipped rows: pin 100, rename 200, fork 300, archive 400, session id 450. */
const MENU_ITEM_ORDER = 500;
const HEADER_BUTTON_ID = "dsh-split.split";
/** Last of the header utilities, next to the right sidebar's corner button. */
const HEADER_BUTTON_ORDER = 900;

/** Required services; `shortcuts` is optional and reached through `ctx.inject`. */
export const inject = ["slots", "locale", "sessions", "uiWorkspace", "sidebarRight"];

function injectStyle(file: string, css: string): () => void {
	const id = `${PKG}/${file}`;
	document.head.querySelector(`style[data-plugin-css="${CSS.escape(id)}"]`)?.remove();
	const element = document.createElement("style");
	element.dataset.plugin = PKG;
	element.dataset.pluginCss = id;
	element.textContent = css;
	document.head.append(element);
	return () => element.remove();
}

/** `ctx.effect` disposers are callable; older builds handed out a Disposable. */
function dispose(disposer: Disposer | { [Symbol.dispose]?: () => void }): void {
	if (typeof disposer === "function") disposer();
	else disposer[Symbol.dispose]?.();
}

function knownSessions(list: SessionListState): ReadonlySet<string> {
	return new Set(list.ids);
}

export function apply(ctx: ClientContext): void {
	ctx.effect(() => registerLocale(ctx), "dsh-split: locale");
	ctx.effect(() => injectStyle("rail-ui.css", uiCss()), "dsh-split: kit style");
	ctx.effect(() => injectStyle("split.css", SPLIT_CSS), "dsh-split: style");
	const t = ctx.locale.bind(NS) as Translate;

	const anchor = createAnchorStore();
	const overlay = createOverlayStore();
	const drag = createDragStore();
	let workspaces: ClientWorkspaces | undefined;
	let shadow: Disposer | null = null;
	let cancelFocus: (() => void) | undefined;
	let paneSeq = 0;

	// The mode roster comes from the bundle's own Host route: a profile without the preset
	// registry answers an empty list and the surface starts with the deployment default.
	let defaultPreset: string | undefined;
	const loadPresets = async (): Promise<readonly PanePreset[]> => {
		try {
			const response = await fetch("/api/split/presets", {
				headers: { "x-split": "1" },
				credentials: "same-origin",
			});
			if (!response.ok) return [];
			const body = (await response.json()) as {
				presets?: readonly {
					id: string;
					name?: string;
					description?: string;
					isDefault?: boolean;
				}[];
			};
			const presets = body.presets ?? [];
			defaultPreset = presets.find((preset) => preset.isDefault === true)?.id;
			return presets.map((preset) => {
				const known = `mode.${preset.id}`;
				const localized = (t as unknown as (key: string) => string)(known);
				return {
					id: preset.id,
					name: preset.name ?? (localized === known ? preset.id : localized),
					...(preset.description === undefined ? {} : { description: preset.description }),
				};
			});
		} catch {
			return [];
		}
	};

	const host: HostPorts = {
		openSession: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
		mainSession: () => ctx.sidebarRight.mounted.getSnapshot(),
		async createSession(near, options) {
			// A chosen folder is registered as a Workspace first, so the conversation joins the
			// same project list the sidebar shows.
			let workspaceId = options?.workspaceId;
			if (workspaceId === undefined && options?.path !== undefined && workspaces !== undefined) {
				workspaceId = (await workspaces.create({ path: options.path })).workspaceId;
			}
			// Without an explicit choice the conversation joins the Workspace of the one it is
			// opened beside; without a Workspace it starts in the same directory.
			workspaceId ??=
				near === undefined
					? undefined
					: workspaces?.list.getSnapshot().items.find((item) => item.sessionIds.includes(near))
							?.workspaceId;
			const agentPreset = options?.agentPreset;
			if (workspaceId !== undefined)
				return ctx.sessions.create({
					workspaceId,
					...(agentPreset === undefined ? {} : { agentPreset }),
				});
			const cwd =
				options?.path ?? (near === undefined ? undefined : ctx.sessions.list.getSnapshot().byId[near]?.cwd);
			return ctx.sessions.create({
				...(cwd === undefined ? {} : { cwd }),
				...(agentPreset === undefined ? {} : { agentPreset }),
			});
		},
		createFailed(error) {
			console.error("[dsh-split] creating a conversation failed", error);
			overlay.toast({ text: t("toast.createFailed"), tone: "error" });
		},
		paneLimit() {
			overlay.toast({ text: t("toast.paneLimit"), tone: "info" });
		},
		surfaceSize() {
			const box =
				shadow === null ? measureCenterColumn(document) : anchor.get()?.getBoundingClientRect();
			return box === undefined || box === null || box.width === 0
				? undefined
				: { width: box.width, height: box.height };
		},
		enterSplit() {
			if (shadow !== null) return;
			shadow = ctx.effect(() => {
				const placeholder = ctx.slots.inject("main.conversation", () =>
					ctx.slots.register(
						// The single slot is shadowed only below the shipped priority 0.
						{ name: "main.conversation", priority: -1, inject: () => ({ anchor }) },
						SplitAnchor,
					),
				);
				const removeStyle = injectStyle("split-active.css", SPLIT_ACTIVE_CSS);
				return () => {
					dispose(placeholder);
					removeStyle();
				};
			}, "dsh-split: placeholder");
		},
		leaveSplit() {
			const current = shadow;
			shadow = null;
			if (current !== null) dispose(current);
		},
		readStorage() {
			try {
				return globalThis.localStorage.getItem(STORAGE_KEY);
			} catch {
				return null;
			}
		},
		writeStorage(value) {
			try {
				if (value === null) globalThis.localStorage.removeItem(STORAGE_KEY);
				else globalThis.localStorage.setItem(STORAGE_KEY, value);
			} catch {
				// Unavailable or full storage leaves the in-memory layout usable.
			}
		},
		focusPaneElement(id) {
			cancelFocus?.();
			cancelFocus = requestPaneFocus(id);
		},
		newPaneId: () => `p${Date.now().toString(36)}${(paneSeq++).toString(36)}`,
		schedule(run, ms) {
			const timer = setTimeout(run, ms);
			return () => clearTimeout(timer);
		},
	};
	const controller = createSplitController(host);

	// Workspaces are optional: without the service a new conversation starts in the directory of
	// the one it is opened beside.
	ctx.inject(["workspaces"], (child) => {
		child.effect(() => {
			workspaces = child.workspaces;
			return () => {
				workspaces = undefined;
			};
		}, "dsh-split: workspaces");
	});

	// Power: a background window keeps its timers but stops decorative motion. The attribute is
	// toggled on the root element so one selector in the bundle's sheet covers every surface.
	ctx.effect(() => {
		const root = document.documentElement;
		const sync = (): void => {
			if (document.visibilityState === "hidden") root.dataset.rfBackground = "";
			else delete root.dataset.rfBackground;
		};
		document.addEventListener("visibilitychange", sync);
		sync();
		return () => {
			document.removeEventListener("visibilitychange", sync);
			delete root.dataset.rfBackground;
		};
	}, "dsh-split: background power");
	// Quiet mode: the same pause for a window in front, for long battery runs. Off by default;
	// `dsh-split.quiet` in localStorage turns it on without a rebuild.
	ctx.effect(() => {
		const root = document.documentElement;
		let quiet = false;
		try {
			quiet = globalThis.localStorage.getItem("dsh-split.quiet") === "1";
		} catch {
			quiet = false;
		}
		root.classList.toggle("rf-quiet", quiet);
		return () => root.classList.remove("rf-quiet");
	}, "dsh-split: quiet mode");
	ctx.effect(() => trackHostDrags(document, drag), "dsh-split: drag sources");
	ctx.effect(() => trackKeyboardNavigation(document), "dsh-split: keyboard navigation");

	// Host notifications are handled outside the notifying call: a synchronous `sessions.list`
	// subscriber that reaches `retain` or `openSession` re-enters the sessions service.
	ctx.effect(() => {
		const mounted = ctx.sidebarRight.mounted;
		// Several changes in one task queue several reads of the same final value; report it once.
		let last = mounted.getSnapshot();
		return mounted.subscribe(() => {
			queueMicrotask(() => {
				const current = mounted.getSnapshot();
				if (current === last) return;
				last = current;
				controller.mainChanged(current);
			});
		});
	}, "dsh-split: follow main session");
	ctx.effect(() => {
		let restored = false;
		let lastIds: SessionListState["ids"] | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const check = (): void => {
			timer = undefined;
			const list = ctx.sessions.list.getSnapshot();
			if (list.phase !== "ready" || list.ids === lastIds) return;
			lastIds = list.ids;
			if (!restored) {
				restored = true;
				controller.restore(knownSessions(list));
			} else controller.sessionsChanged(knownSessions(list));
		};
		const schedule = (): void => {
			if (timer === undefined) timer = setTimeout(check, 0);
		};
		const unsubscribe = ctx.sessions.list.subscribe(schedule);
		schedule();
		return () => {
			unsubscribe();
			if (timer !== undefined) clearTimeout(timer);
		};
	}, "dsh-split: session list");

	ctx.effect(
		() => ctx.slots.inject(PANE_SLOT, () => ctx.slots.register({ name: PANE_SLOT }, PaneBody)),
		"dsh-split: pane body",
	);
	ctx.effect(
		() =>
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register(
					{
						name: "shell.overlay",
						id: OVERLAY_ID,
						locale: NS,
						children: {
							[PANE_SLOT]: { kind: "single", scope: "session" },
							// Root scope: the pane header renders above its SessionProvider, so the
							// session id and running state travel as owner props.
							"dsh-split.pane.actions": { kind: "list", scope: "root" },
						},
						inject: () => ({
							controller,
							anchor,
							overlay,
							drag,
							sessions: ctx.sessions,
							loadPresets,
							defaultPreset: () => defaultPreset,
							workspaceOf: (sessionId: string | undefined) =>
								sessionId === undefined
									? undefined
									: workspaces?.list
											.getSnapshot()
											.items.find((item) => item.sessionIds.includes(sessionId))?.workspaceId,
							toggleSidebar: () => ctx.sidebarRight.toggleExpanded(),
						}),
					},
					SplitOverlay,
				),
			),
		"dsh-split: overlay",
	);
	ctx.effect(
		() =>
			ctx.slots.inject("sidebar.workspaces.session.menu.item", () =>
				ctx.slots.register(
					{
						name: "sidebar.workspaces.session.menu.item",
						id: MENU_ITEM_ID,
						order: MENU_ITEM_ORDER,
						locale: NS,
						inject: () => ({ openInSplit: (id: string) => controller.openInSplit(id) }),
					},
					SessionMenuItem,
				),
			),
		"dsh-split: session menu item",
	);
	ctx.effect(
		() =>
			ctx.slots.inject("conversation.session.header.utilities", () =>
				ctx.slots.register(
					{
						name: "conversation.session.header.utilities",
						id: HEADER_BUTTON_ID,
						order: HEADER_BUTTON_ORDER,
						label: () => t("header.split"),
						locale: NS,
						inject: () => ({ controller, drag, overlay }),
					},
					SplitButton,
				),
			),
		"dsh-split: header button",
	);
	ctx.inject(["shortcuts"], (child) => {
		child.effect(() => registerShortcuts(child.shortcuts, controller, t), "dsh-split: shortcuts");
	});

	ctx.effect(
		() => () => {
			cancelFocus?.();
			drag.end();
			overlay.closeAll();
			host.leaveSplit();
			controller.dispose();
		},
		"dsh-split: teardown",
	);
}
