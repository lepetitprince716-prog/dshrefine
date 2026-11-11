// The `shell.overlay` entry that hosts the panes over the placeholder's box. Panes are rendered
// flat: every pane is keyed by its id and absolutely positioned from the tree, and dividers sit
// on their own layer, so splitting, closing or resizing never remounts another pane. Each pane is
// a flat column of the app; while a split drag is in progress every visible pane (or, without a
// split, the main conversation) carries a drop surface. An empty pane shows its home surface, so a
// new conversation chooses its own project and mode instead of inheriting the main view's.
import { OverlayLayer, OverlayProvider, type OverlayStore } from "@refine/ui";
import {
	type CSSProperties,
	type DragEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { ClientSessions, RootSlotProps } from "../dsh-types.d.ts";
import {
	fitLayout,
	MIN_PANE_HEIGHT,
	MIN_PANE_WIDTH,
	PANE_GAP,
	ratioBounds,
} from "../layout/fit.ts";
import { type DividerBox, fitsPanes, layoutGeometry, type Rect } from "../layout/geometry.ts";
import {
	balanceAll,
	type LayoutState,
	nodeAt,
	type PaneId,
	type PaneNode,
	panes,
} from "../layout/tree.ts";
import { type AnchorStore, useAnchorRect } from "./anchor.ts";
import type { SplitController, SplitView } from "./controller.ts";
import { Divider } from "./Divider.tsx";
import { DropLayer } from "./DropLayer.tsx";
import { type DragState, type DragStore, measureCenterColumn, startOwnDrag } from "./drag.ts";
import { paneFocusAction } from "./focus.ts";
import type { Translate } from "./locale.ts";
import { CreatingNote, PaneHeader } from "./PaneFrame.tsx";
import { PaneHome, type PanePreset } from "./PaneHome.tsx";
import { PaneSession } from "./PaneSession.tsx";
import { Picker } from "./Picker.tsx";
import { Switcher } from "./Switcher.tsx";

const GAP = PANE_GAP;
/** Offset of the geometry inside the surface: each card is inset by half a gap within its box. */
const ORIGIN = GAP / 2;
/** Height of the pill strip shown while one pane at a time is visible. */
const SWITCHER_HEIGHT = 40;
/** How long pane boxes animate after the tree changes shape, in ms. */
const ANIMATION_MS = 260;

export interface OverlayInjected {
	readonly controller: SplitController;
	readonly anchor: AnchorStore;
	readonly sessions: ClientSessions;
	readonly overlay: OverlayStore;
	readonly drag: DragStore;
	readonly toggleSidebar: () => void;
	/** Agent modes for the home surface, read from the host roster on demand. */
	readonly loadPresets: () => Promise<readonly PanePreset[]>;
	readonly defaultPreset: () => string | undefined;
	/** The Workspace a new conversation beside this pane inherits, when it has one. */
	readonly workspaceOf: (sessionId: string | undefined) => string | undefined;
}

type OverlayProps = OverlayInjected & RootSlotProps;

/** Keep pane DOM order stable across tree edits: moving a node would reset its scroll. */
function useStableOrder(ids: readonly PaneId[]): readonly PaneId[] {
	const order = useRef<PaneId[]>([]);
	const present = new Set(ids);
	const kept = order.current.filter((id) => present.has(id));
	for (const id of ids) if (!kept.includes(id)) kept.push(id);
	order.current = kept;
	return kept;
}

/** The tree's shape without its ratios: a change means panes moved, appeared or went away. */
function shapeOf(node: PaneNode): string {
	return node.kind === "pane"
		? node.id
		: `${node.axis}(${shapeOf(node.first)},${shapeOf(node.second)})`;
}

/**
 * Whether pane boxes should animate now. Decided during render, so the transition is already in
 * place when the boxes take their new positions; a resize or a divider drag never animates.
 */
function useShapeAnimation(shape: string): boolean {
	const last = useRef({ shape, until: 0 });
	const [, rerender] = useState(0);
	const now = performance.now();
	if (last.current.shape !== shape) last.current = { shape, until: now + ANIMATION_MS };
	const animating = now < last.current.until;
	useEffect(() => {
		if (!animating) return;
		const timer = setTimeout(
			() => rerender((n) => n + 1),
			last.current.until - performance.now() + 16,
		);
		return () => clearTimeout(timer);
	}, [animating]);
	return animating;
}

/** The start inset the host keeps free for the macOS window controls, read from the frame. */
function leadingClearance(element: HTMLElement | null): number {
	if (element === null || !element.isConnected) return 0;
	const value = Number.parseFloat(
		getComputedStyle(element).getPropertyValue("--dsh-frame-leading-clearance"),
	);
	return Number.isFinite(value) ? value : 0;
}

/** The ratios a divider may take without shrinking a card below its minimum size. */
function dividerBounds(root: PaneNode, divider: DividerBox): readonly [number, number] | undefined {
	const node = nodeAt(root, divider.path);
	if (node === undefined || node.kind === "pane") return undefined;
	return ratioBounds(node, divider.axis === "row" ? divider.area.width : divider.area.height);
}

export function SplitOverlay(props: OverlayProps): ReactNode {
	const { controller, anchor, overlay, drag } = props;
	const t = props.t as Translate;
	const layout = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
	const view = useSyncExternalStore(controller.subscribe, controller.getView);
	const dragging = useSyncExternalStore(drag.subscribe, drag.getSnapshot);
	const rect = useAnchorRect(anchor);
	const ids = layout === null ? [] : panes(layout.root).map((pane) => pane.id);
	const order = useStableOrder(ids);
	return (
		<OverlayProvider store={overlay}>
			{layout !== null ? (
				<SplitSurface
					{...props}
					layout={layout}
					view={view}
					dragging={dragging}
					rect={rect}
					order={order}
				/>
			) : dragging !== null ? (
				<MainDropSurface controller={controller} drag={dragging} t={t} />
			) : null}
			<OverlayLayer store={overlay} toastCloseLabel={t("pane.close")} />
		</OverlayProvider>
	);
}

/** Without a split: a drop surface over the host's centre column, measured once per drag. */
function MainDropSurface(props: {
	readonly controller: SplitController;
	readonly drag: DragState;
	readonly t: Translate;
}): ReactNode {
	const [rect] = useState(() => measureCenterColumn(document));
	if (rect === null) return null;
	return (
		<DropLayer
			className="rf-root dsp-drop-main"
			style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
			target={{ kind: "main" }}
			controller={props.controller}
			drag={props.drag}
			t={props.t}
		/>
	);
}

interface SurfaceProps extends OverlayProps {
	readonly layout: LayoutState;
	readonly view: SplitView;
	readonly dragging: DragState | null;
	readonly rect: Rect | null;
	readonly order: readonly PaneId[];
}

function SplitSurface(props: SurfaceProps): ReactNode {
	const { layout, view, dragging, rect, order, controller, drag } = props;
	const t = props.t as Translate;
	const [resizing, setResizing] = useState(false);
	const box = rect ?? { left: 0, top: 0, width: 0, height: 0 };
	const geometry = layoutGeometry(
		layout.root,
		Math.max(0, box.width - 2 * ORIGIN),
		Math.max(0, box.height - 2 * ORIGIN),
	);
	const narrow = !fitsPanes(geometry, MIN_PANE_WIDTH + GAP, MIN_PANE_HEIGHT + GAP);
	const single = narrow || view.zoomed;
	// When moving dividers would show every pane again, offer to even them out and make room.
	const { width, height } = box;
	const evenFits = useMemo(
		() => narrow && fitLayout(balanceAll(layout.root), { width, height }) !== undefined,
		[narrow, layout.root, width, height],
	);
	const animating = useShapeAnimation(`${shapeOf(layout.root)}|${single ? layout.focus : ""}`);
	const clearance = useMemo(
		() => (rect === null ? 0 : leadingClearance(props.anchor.get())),
		[rect, props.anchor],
	);
	const descriptors = panes(layout.root);
	const statuses = props.useSessionStatus((map) => map);
	const sessionOf = new Map(descriptors.map((pane) => [pane.id, pane.sessionId]));
	const shown = new Set(descriptors.flatMap((pane) => pane.sessionId ?? []));
	// The picker leaves out what the sidebar hides as well: archived Sessions.
	const archived = props.useWorkspaces((snapshot) => snapshot.archivedSessionIds);
	const unpickable = new Set([...shown, ...archived]);
	const boxes = new Map(geometry.panes.map((pane) => [pane.id, pane]));
	const canAdd = controller.canAddPane();
	const draggedPane = dragging?.payload.kind === "pane" ? dragging.payload.paneId : undefined;

	const rootStyle: CSSProperties = {
		left: box.left,
		top: box.top,
		width: box.width,
		height: box.height,
		display: rect === null ? "none" : undefined,
	};
	const singleBox: Rect = {
		left: GAP,
		top: SWITCHER_HEIGHT,
		width: Math.max(0, box.width - 2 * GAP),
		height: Math.max(0, box.height - SWITCHER_HEIGHT - GAP),
	};

	return (
		<div
			className="rf-root dsp-root"
			data-split-root=""
			data-single={single ? "" : undefined}
			data-resizing={resizing ? "" : undefined}
			data-dnd={dragging === null ? undefined : ""}
			data-animate={animating ? "" : undefined}
			style={rootStyle}
		>
			<div className="dsp-titlebar" data-window-drag="" aria-hidden="true" />
			{single ? (
				<Switcher
					order={descriptors.map((pane) => pane.id)}
					focus={layout.focus}
					sessionOf={sessionOf}
					creating={view.creating}
					useSessions={props.useSessions}
					useSessionStatus={props.useSessionStatus}
					useWorkspaces={props.useWorkspaces}
					onPick={(id) => controller.select(id)}
					onRestore={view.zoomed && !narrow ? () => controller.toggleZoom() : undefined}
					onEven={evenFits ? () => controller.balanceAll() : undefined}
					leadingInset={clearance > box.left ? clearance - box.left : 0}
					t={t}
				/>
			) : null}
			{order.map((id) => {
				const sessionId = sessionOf.get(id);
				const paneBox = boxes.get(id);
				if (paneBox === undefined) return null;
				const active = id === layout.focus;
				const creating = view.creating.has(id);
				const card: Rect = single
					? singleBox
					: {
							left: ORIGIN + paneBox.left + GAP / 2,
							top: ORIGIN + paneBox.top + GAP / 2,
							width: Math.max(0, paneBox.width - GAP),
							height: Math.max(0, paneBox.height - GAP),
						};
				const topRow = !single && paneBox.top === 0;
				const absoluteLeft = box.left + card.left;
				const leadingInset = topRow && clearance > absoluteLeft ? clearance - absoluteLeft : 0;
				return (
					<section
						key={id}
						className="dsp-pane"
						data-split-pane={id}
						data-active={active ? "" : undefined}
						data-drag-source={draggedPane === id ? "" : undefined}
						hidden={single && !active}
						tabIndex={-1}
						style={card}
						onFocusCapture={(event) => {
							const focus = controller.getSnapshot()?.focus;
							const action = paneFocusAction(focus === id, event.timeStamp);
							if (action === "activate") controller.activate(id);
							else if (action === "refocus" && focus !== undefined) controller.select(focus);
						}}
						onPointerDownCapture={() => controller.activate(id)}
					>
						<PaneHeader
							paneId={id}
							sessionId={sessionId}
							active={active}
							creating={creating}
							zoomed={view.zoomed}
							narrow={narrow}
							topRow={topRow}
							leadingInset={leadingInset}
							canAdd={canAdd}
							useSessions={props.useSessions}
							useSessionStatus={props.useSessionStatus}
							useWorkspaces={props.useWorkspaces}
							onNew={() => controller.newBeside(id)}
							onNewDragStart={(event: DragEvent<HTMLElement>) =>
								startOwnDrag(event.dataTransfer, drag, { kind: "new" }, t("ghost.new"))
							}
							onGripDragStart={(event: DragEvent<HTMLElement>, title: string) =>
								startOwnDrag(event.dataTransfer, drag, { kind: "pane", paneId: id }, title)
							}
							onSplit={(axis) => {
								controller.activate(id);
								controller.splitActive(axis);
							}}
							onZoom={() => {
								controller.select(id);
								controller.toggleZoom();
							}}
							onClose={() => controller.closePane(id)}
							onToggleSidebar={props.toggleSidebar}
							actions={
								sessionId === undefined
									? undefined
									: props.renderSlot("dsh-split.pane.actions", {
											sessionId,
											running: statuses.get(sessionId)?.running === true,
										})
							}
							t={t}
						/>
						<div className="dsp-pane-main" data-pane-main="">
							{sessionId !== undefined ? (
								<PaneSession
									key={sessionId}
									paneId={id}
									sessionId={sessionId}
									active={active}
									running={statuses.get(sessionId)?.running === true}
									sessions={props.sessions}
									SessionProvider={props.SessionProvider}
									renderSlot={props.renderSlot}
									t={t}
								/>
							) : creating ? (
								<CreatingNote t={t} />
							) : (
								<PanePickerOrHome
									paneId={id}
									controller={controller}
									useSessions={props.useSessions}
									useWorkspaces={props.useWorkspaces}
									shown={unpickable}
									loadPresets={props.loadPresets}
									defaultPreset={props.defaultPreset}
									defaultWorkspaceId={props.workspaceOf(
										panes(layout.root).find((pane) => pane.sessionId !== undefined)?.sessionId,
									)}
									t={t}
								/>
							)}
						</div>
						{dragging === null || (single && !active) ? null : (
							<DropLayer
								target={{ kind: "pane", paneId: id }}
								controller={controller}
								drag={dragging}
								t={t}
							/>
						)}
					</section>
				);
			})}
			{single
				? null
				: geometry.dividers.map((divider) => (
						<Divider
							key={`${divider.path.join(".")}:${divider.axis}`}
							divider={divider}
							origin={ORIGIN}
							bounds={dividerBounds(layout.root, divider)}
							onRatio={(ratio) => controller.setRatio(divider.path, ratio)}
							onBalance={() => controller.balance(divider.path)}
							onResizing={setResizing}
							t={t}
						/>
					))}
		</div>
	);
}

/**
 * What an empty pane shows: the home surface that starts a conversation in a chosen project and
 * mode, with the host's session picker one click away. Mounted only while the pane has no
 * Session, so the preset roster is read when the surface is actually opened.
 */
function PanePickerOrHome(props: {
	readonly paneId: PaneId;
	readonly controller: SplitController;
	readonly useSessions: RootSlotProps["useSessions"];
	readonly useWorkspaces: RootSlotProps["useWorkspaces"];
	readonly shown: ReadonlySet<string>;
	readonly loadPresets: () => Promise<readonly PanePreset[]>;
	readonly defaultPreset: () => string | undefined;
	readonly defaultWorkspaceId: string | undefined;
	readonly t: Translate;
}): ReactNode {
	const [mode, setMode] = useState<"home" | "picker">("home");
	const [presets, setPresets] = useState<readonly PanePreset[]>([]);
	const workspaces = props.useWorkspaces((snapshot) => snapshot);

	useEffect(() => {
		let alive = true;
		props.loadPresets().then(
			(list) => {
				if (alive) setPresets(list);
			},
			() => {
				// Without the roster the home surface still starts a conversation with the default mode.
			},
		);
		return () => {
			alive = false;
		};
	}, [props.loadPresets]);

	if (mode === "picker") {
		return (
			<Picker
				useSessions={props.useSessions}
				shown={props.shown}
				onPick={(picked) => props.controller.assign(props.paneId, picked)}
				onCreate={() => props.controller.createIn(props.paneId)}
				t={props.t}
			/>
		);
	}
	return (
		<PaneHome
			workspaces={workspaces.items}
			workspacesReady={workspaces.phase === "ready"}
			defaultWorkspaceId={props.defaultWorkspaceId}
			presets={presets}
			defaultPreset={props.defaultPreset()}
			onStart={(input) => props.controller.startIn(props.paneId, input)}
			onOpenExisting={() => setMode("picker")}
			t={props.t}
		/>
	);
}
