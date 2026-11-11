// Minimal structural typings for the dsh client services this bundle uses. Derived by hand from
// the installed @deepseek-ai/* 0.2.1-rc.1 declaration files (dsh-api-session-controller,
// dsh-api-workspace-controller, dsh-client-ui-workspace, dsh-client-ui-sidebar-right,
// dsh-client-shortcuts) and the client slot catalog (docs/notes/dsh-client-api.md); only the
// members the bundle calls are listed.

import type { ReactNode } from "react";

export type Disposer = () => unknown;
export type SessionId = string;

/** `ObservableSnapshot<T>` of dsh-client-store. */
export interface ObservableSnapshot<T> {
	getSnapshot(): T;
	subscribe(listener: () => void): () => void;
}

export interface SessionSummary {
	readonly id: SessionId;
	readonly title?: string;
	readonly displayTitle: string;
	readonly cwd?: string;
	readonly parentId?: SessionId;
	readonly origin?: "subagent";
	readonly running: boolean;
	readonly blank: boolean;
	readonly updatedAt: number;
}

export interface SessionListState {
	readonly ids: readonly SessionId[];
	readonly byId: Readonly<Record<SessionId, SessionSummary>>;
	readonly phase: "pending" | "ready";
}

export interface SessionStatus {
	readonly running: boolean;
	readonly pendingInteraction: boolean;
	readonly completionUnread: boolean;
}

/** An owned use of one Client generation; release once. */
export interface SessionReference {
	readonly sessionId: SessionId;
	release(): void;
}

export interface ClientSessions {
	readonly list: ObservableSnapshot<SessionListState>;
	retain(
		target: SessionId,
		options: { readonly source: string; readonly signal?: AbortSignal },
	): SessionReference | undefined;
	/** `workspaceId` and `cwd` are alternatives. */
	create(options?: {
		readonly workspaceId?: string;
		readonly cwd?: string;
		readonly agentPreset?: string;
	}): Promise<SessionId>;
}

/** `WorkspaceView` of dsh-api-workspace-controller. */
export interface WorkspaceView {
	readonly workspaceId: string;
	readonly path: string;
	readonly title: string;
	/** Sessions accounted to this Workspace, in manual order. */
	readonly sessionIds: readonly SessionId[];
}

export interface WorkspaceSnapshot {
	readonly items: readonly WorkspaceView[];
	/** Every archived Session, across Workspaces. */
	readonly archivedSessionIds: readonly SessionId[];
	readonly phase: "pending" | "ready";
}

/** `IWorkspaces` of dsh-api-workspace-controller (the `workspaces` service). */
export interface ClientWorkspaces {
	readonly list: ObservableSnapshot<WorkspaceSnapshot>;
	/** Register an existing directory as a Workspace. */
	create(input: { readonly path: string }): Promise<WorkspaceView>;
}

export interface ClientUiWorkspace {
	openSession(target: SessionId): void;
}

export interface ClientSidebarRight {
	/** The Session on screen, while the conversation panel is the active main panel. */
	readonly mounted: ObservableSnapshot<SessionId | undefined>;
	isExpanded(): boolean;
	toggleExpanded(): void;
}

export type ShortcutModifier = "primary" | "control" | "alt" | "shift" | "meta";

export interface ShortcutBinding {
	readonly code: string;
	readonly modifiers: readonly ShortcutModifier[];
}

export type ShortcutResolution =
	| { readonly status: "handled"; run(): void }
	| { readonly status: "blocked"; readonly reason: string }
	| { readonly status: "pass" };

export interface ClientShortcuts {
	readonly runtime: "desktop" | "web";
	readonly platform: "macos" | "windows" | "linux";
	describeBinding(binding: ShortcutBinding | null): { readonly conflicts: readonly string[] };
	register(command: {
		readonly id: string;
		readonly label: () => string;
		readonly aliases: readonly string[];
		readonly defaults: Readonly<Record<string, ShortcutBinding>>;
		readonly regions: readonly ("page" | "editable" | "terminal")[];
		readonly modals: readonly string[];
		resolve(context: { readonly target: Element | null }): ShortcutResolution;
	}): () => void;
}

export interface ClientLocale {
	register(
		ns: string,
		dictionaries: { zh: Record<string, string>; en: Record<string, string> },
	): () => void;
	bind(ns: string): (key: string, params?: Record<string, string | number>) => string;
}

export interface SlotChildDeclaration {
	readonly kind: "single" | "list";
	readonly scope: "root" | "session" | "session-maybe";
}

export interface SlotRegistration {
	readonly name: string;
	readonly id?: string;
	readonly order?: number;
	readonly priority?: number;
	/** Required by list slots: the entry's name in host menus and inspectors. */
	readonly label?: () => string;
	readonly locale?: string;
	readonly children?: Readonly<Record<string, SlotChildDeclaration>>;
	/** Face spread into the component's props. */
	readonly inject?: (...args: never[]) => Record<string, unknown>;
}

export interface ClientSlots {
	inject(owner: string, register: () => Disposer | undefined): Disposer;
	register(options: SlotRegistration, component: (props: never) => ReactNode): Disposer;
}

export interface ClientContext {
	effect(execute: () => Disposer | undefined, label?: string): Disposer;
	inject(services: readonly string[], apply: (ctx: ClientContext) => void): void;
	readonly slots: ClientSlots;
	readonly locale: ClientLocale;
	readonly sessions: ClientSessions;
	readonly uiWorkspace: ClientUiWorkspace;
	readonly sidebarRight: ClientSidebarRight;
	readonly shortcuts: ClientShortcuts;
	readonly workspaces: ClientWorkspaces;
}

/** Standard props of a root-scope slot entry (renderer catalog `standardProps`). */
export interface RootSlotProps {
	readonly useSessions: <S>(selector: (state: SessionListState) => S) => S;
	readonly useSessionStatus: <S>(
		selector: (status: ReadonlyMap<SessionId, SessionStatus>) => S,
	) => S;
	readonly useWorkspaces: <S>(selector: (snapshot: WorkspaceSnapshot) => S) => S;
	readonly renderSlot: (name: string, owner: Record<string, unknown>) => ReactNode;
	readonly renderFactorySlot: (
		name: string,
		props: Record<string, unknown>,
		options?: { readonly slots?: Record<string, (props: never) => ReactNode> },
	) => ReactNode;
	readonly SessionProvider: (props: {
		readonly session: SessionReference;
		readonly children?: ReactNode;
	}) => ReactNode;
	readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** `SessionSnapshot` fields the bundle reads (dsh-api-session-controller). */
export interface SessionSnapshot {
	readonly sessionId: SessionId;
	readonly blank: boolean;
	readonly awaitingFirstTurn: boolean;
	readonly running: boolean;
	readonly promptAttempted?: boolean;
	readonly openState?: string;
	readonly subagent?: {
		readonly address: { readonly mode: string };
		readonly parentAvailable?: boolean;
	} | null;
}

/** Conversation snapshot fields the bundle reads (dsh-client-ui-conversation). */
export interface ConversationSnapshot {
	readonly activeTargets: ReadonlySet<unknown>;
}

/** Standard props of a session-scope slot entry. */
export interface SessionSlotProps extends RootSlotProps {
	readonly sessionId: SessionId;
	readonly useSession: <S>(selector: (snapshot: SessionSnapshot) => S) => S;
	readonly useConversation: <S>(selector: (snapshot: ConversationSnapshot) => S) => S;
}
