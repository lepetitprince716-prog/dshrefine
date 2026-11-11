// A pane's header: status, "Workspace / title" crumbs that double as the handle for moving the
// pane, and the pane actions. The crumbs follow the host conversation header's look (13px,
// rounded hover), so a split reads like several conversations side by side.
import {
	Icon,
	IconButton,
	type IconButtonProps,
	Spinner,
	StatusDot,
	type StatusDotStatus,
	Tooltip,
} from "@refine/ui";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import type { RootSlotProps, SessionStatus } from "../dsh-types.d.ts";
import type { PaneId, SessionId, SplitAxis } from "../layout/tree.ts";
import {
	MaximizeGlyph,
	RestoreGlyph,
	SidebarGlyph,
	SplitDownGlyph,
	SplitRightGlyph,
} from "./glyphs.tsx";
import type { Translate } from "./locale.ts";

export type PaneInfoHooks = Pick<
	RootSlotProps,
	"useSessions" | "useSessionStatus" | "useWorkspaces"
>;

function paneStatus(status: SessionStatus | undefined): StatusDotStatus | undefined {
	if (status === undefined) return undefined;
	if (status.pendingInteraction) return "attention";
	if (status.running) return "running";
	if (status.completionUnread) return "done";
	return undefined;
}

const STATUS_LABEL = {
	attention: "pane.attention",
	running: "pane.running",
	done: "pane.done",
	idle: "pane.done",
	error: "pane.failed",
} as const;

export interface PaneInfo {
	readonly title: string;
	/** Title of the Workspace the Session belongs to, when it has one. */
	readonly workspace: string | undefined;
	readonly status: StatusDotStatus | undefined;
}

export function usePaneInfo(
	hooks: PaneInfoHooks,
	sessionId: SessionId | undefined,
	creating: boolean,
	t: Translate,
): PaneInfo {
	// A blank Session's display title is its Workspace name; the sidebar calls it a new session.
	const title = hooks.useSessions((state) => {
		const summary = sessionId === undefined ? undefined : state.byId[sessionId];
		return summary === undefined || summary.blank ? undefined : summary.displayTitle;
	});
	const status = hooks.useSessionStatus((map) =>
		paneStatus(sessionId === undefined ? undefined : map.get(sessionId)),
	);
	const workspace = hooks.useWorkspaces((snapshot) =>
		sessionId === undefined
			? undefined
			: snapshot.items.find((item) => item.sessionIds.includes(sessionId))?.title,
	);
	if (sessionId === undefined)
		return {
			title: t("picker.title"),
			workspace: undefined,
			status: undefined,
		};
	return {
		title: title ?? t("pane.untitled"),
		workspace: workspace === "" ? undefined : workspace,
		status,
	};
}

export function HeaderButton({
	label,
	...rest
}: { readonly label: string } & Omit<IconButtonProps, "label" | "size">): ReactNode {
	return (
		<Tooltip label={label} placement="bottom-end">
			<IconButton size="sm" label={label} {...rest} />
		</Tooltip>
	);
}

export interface PaneHeaderProps extends PaneInfoHooks {
	readonly paneId: PaneId;
	readonly sessionId: SessionId | undefined;
	readonly active: boolean;
	readonly creating: boolean;
	readonly zoomed: boolean;
	/** One pane at a time is shown because the panes do not fit; maximizing means nothing then. */
	readonly narrow: boolean;
	/** Panes touching the top edge carry the desktop window's drag strip. */
	readonly topRow: boolean;
	/** Extra start padding that clears the macOS window controls, in px. */
	readonly leadingInset: number;
	readonly canAdd: boolean;
	readonly onNew: () => void;
	readonly onNewDragStart: (event: DragEvent<HTMLElement>) => void;
	readonly onGripDragStart: (event: DragEvent<HTMLElement>, title: string) => void;
	readonly onSplit: (axis: SplitAxis) => void;
	readonly onZoom: () => void;
	readonly onClose: () => void;
	readonly onToggleSidebar: () => void;
	/** Contributions from other bundles (history and background controls) for this Session. */
	readonly actions?: ReactNode;
	readonly t: Translate;
}

/**
 * Marks the start inset kept for the macOS window controls as not draggable: the host's controls
 * seat sits there, and the strip's drag region would otherwise cover its buttons.
 */
export function LeadingGap(props: { readonly width: number }): ReactNode {
	return props.width > 0 ? (
		<span className="dsp-lead" aria-hidden="true" style={{ width: props.width }} />
	) : null;
}

export function PaneHeader(props: PaneHeaderProps): ReactNode {
	const { sessionId, active, creating, zoomed, narrow, canAdd, t } = props;
	const { title, workspace, status } = usePaneInfo(props, sessionId, creating, t);
	const style: CSSProperties | undefined =
		props.leadingInset > 0 ? { paddingLeft: props.leadingInset } : undefined;
	return (
		<header
			className="dsp-pane-head"
			data-window-drag={props.topRow ? "" : undefined}
			style={style}
		>
			<LeadingGap width={props.leadingInset} />
			{/* biome-ignore lint/a11y/noStaticElementInteractions: dragging and double-clicking the title are pointer shortcuts for the maximize button and the drop targets. */}
			<div
				className="dsp-pane-grip"
				draggable
				title={`${title}\n${t("pane.grip")}`}
				onDragStart={(event) => props.onGripDragStart(event, title)}
				onDoubleClick={narrow ? undefined : props.onZoom}
			>
				{creating ? (
					<Spinner size="sm" />
				) : status === undefined ? null : (
					<StatusDot status={status} label={t(STATUS_LABEL[status])} className="dsp-pane-dot" />
				)}
				{workspace === undefined ? null : (
					<>
						<span className="dsp-crumb dsp-crumb-workspace">{workspace}</span>
						<span className="dsp-crumb-sep" aria-hidden="true">
							/
						</span>
					</>
				)}
				<span className="dsp-crumb dsp-crumb-title">{title}</span>
			</div>
			<span className="dsp-pane-actions">
				{props.actions}
				<HeaderButton
					label={canAdd ? t("pane.new") : t("drop.full")}
					icon={<Icon name="plus" size={14} />}
					disabled={!canAdd}
					draggable={canAdd}
					onClick={props.onNew}
					onDragStart={props.onNewDragStart}
				/>
				<HeaderButton
					className="dsp-act-split"
					label={t("pane.splitRight")}
					icon={<SplitRightGlyph />}
					disabled={!canAdd}
					onClick={() => props.onSplit("row")}
				/>
				<HeaderButton
					className="dsp-act-split"
					label={t("pane.splitDown")}
					icon={<SplitDownGlyph />}
					disabled={!canAdd}
					onClick={() => props.onSplit("column")}
				/>
				{narrow ? null : (
					<HeaderButton
						label={zoomed ? t("pane.restore") : t("pane.zoom")}
						icon={zoomed ? <RestoreGlyph /> : <MaximizeGlyph />}
						onClick={props.onZoom}
					/>
				)}
				{active && sessionId !== undefined ? (
					<HeaderButton
						label={t("pane.sidebar")}
						icon={<SidebarGlyph />}
						onClick={props.onToggleSidebar}
					/>
				) : null}
				<HeaderButton
					label={t("pane.close")}
					icon={<Icon name="close" size={14} />}
					onClick={props.onClose}
				/>
			</span>
		</header>
	);
}

/** Body of a pane whose new conversation is being created. */
export function CreatingNote({ t }: { readonly t: Translate }): ReactNode {
	return (
		<div className="dsp-pane-note" role="status">
			<Spinner size="md" />
			<span>{t("pane.creating")}</span>
		</div>
	);
}
