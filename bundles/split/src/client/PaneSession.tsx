// One pane's Session: retained in a mount effect under the bundle's own source label, published
// with the renderer's SessionProvider, and released only after the provider subtree is gone
// (a released generation throws in `bindingSource`). Never retained during render or inside a
// `sessions.list` subscriber (lane-c-dsh-internals.md section 2).
import { Button } from "@refine/ui";
import { memo, type ReactNode, useEffect, useState } from "react";
import type {
	ClientSessions,
	RootSlotProps,
	SessionReference,
	SessionSlotProps,
} from "../dsh-types.d.ts";
import type { PaneId, SessionId } from "../layout/tree.ts";
import type { Translate } from "./locale.ts";
import { panePhase } from "./phase.ts";

/** Retain source label; keeps the panes out of the host's `mainView` count. */
export const RETAIN_SOURCE = "dshSplit";
/** The child slot each pane renders inside its SessionProvider. */
export const PANE_SLOT = "dsh-split.pane";
/** `retain` has been seen to return nothing on 0.2.1; retry a few times before giving up. */
const RETAIN_ATTEMPTS = 3;
const RETAIN_RETRY_MS = 200;

let retaining = false;

/** Retain with a re-entrancy guard: a nested call (through a synchronous list subscriber) waits. */
function retainOnce(
	sessions: ClientSessions,
	sessionId: SessionId,
	signal: AbortSignal,
): SessionReference | undefined | "busy" {
	if (retaining) return "busy";
	retaining = true;
	try {
		return sessions.retain(sessionId, { source: RETAIN_SOURCE, signal });
	} finally {
		retaining = false;
	}
}

type Held =
	| { readonly kind: "opening" }
	| { readonly kind: "failed" }
	| { readonly kind: "held"; readonly reference: SessionReference };

/**
 * How long a pane may sit unfocused without running work before it releases its Session and the
 * conversation tree. The retained Session is the expensive part of a parked pane (stores, wire
 * binding, event window), and restoring it costs one read of the same log.
 */
const SLEEP_AFTER_MS = 20 * 60 * 1000;

export interface PaneSessionProps {
	readonly paneId: PaneId;
	readonly sessionId: SessionId;
	/** The pane holds keyboard focus and is the one a person is looking at. */
	readonly active: boolean;
	/** The Session has a turn or background work in flight; sleeping it would hide progress. */
	readonly running: boolean;
	readonly sessions: ClientSessions;
	readonly SessionProvider: RootSlotProps["SessionProvider"];
	readonly renderSlot: RootSlotProps["renderSlot"];
	readonly t: Translate;
}

/**
 * Keyed by attempt, so "Retry" remounts the retaining part with a fresh effect. Memoized: the
 * surface re-renders on every divider step, drag hover and focus change, and each re-render would
 * otherwise reach the host conversation tree of every pane.
 */
export const PaneSession = memo(function PaneSession(props: PaneSessionProps): ReactNode {
	const [attempt, setAttempt] = useState(0);
	const [asleep, setAsleep] = useState(false);

	// Only an unfocused pane that is not working may sleep; any activation wakes it in the same
	// commit that makes it visible again.
	useEffect(() => {
		if (asleep) {
			if (props.active) setAsleep(false);
			return;
		}
		if (props.active || props.running) return;
		const timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
		return () => clearTimeout(timer);
	}, [asleep, props.active, props.running]);

	if (asleep) {
		return (
			<div className="dsp-pane-sleep">
				<span>{props.t("pane.sleeping")}</span>
				<Button size="sm" variant="secondary" onClick={() => setAsleep(false)}>
					{props.t("pane.wake")}
				</Button>
			</div>
		);
	}
	return <RetainedPane key={attempt} {...props} onRetry={() => setAttempt((n) => n + 1)} />;
});

function RetainedPane({
	paneId,
	sessionId,
	sessions,
	SessionProvider,
	renderSlot,
	t,
	onRetry,
}: PaneSessionProps & { readonly onRetry: () => void }): ReactNode {
	const [held, setHeld] = useState<Held>({ kind: "opening" });

	useEffect(() => {
		const controller = new AbortController();
		let reference: SessionReference | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let tries = 0;
		const acquire = (): void => {
			timer = undefined;
			let result: SessionReference | undefined | "busy";
			try {
				result = retainOnce(sessions, sessionId, controller.signal);
			} catch (error) {
				console.error("[dsh-split] retain failed", sessionId, error);
				result = undefined;
			}
			if (result !== undefined && result !== "busy") {
				reference = result;
				setHeld({ kind: "held", reference: result });
				return;
			}
			if (result === undefined) tries++;
			if (tries >= RETAIN_ATTEMPTS) {
				setHeld({ kind: "failed" });
				return;
			}
			timer = setTimeout(acquire, result === "busy" ? 0 : RETAIN_RETRY_MS);
		};
		acquire();
		return () => {
			if (timer !== undefined) clearTimeout(timer);
			controller.abort();
			const release = reference;
			// The provider subtree unmounts in this same commit; release after it is gone.
			if (release !== undefined) setTimeout(() => release.release(), 0);
		};
	}, [sessions, sessionId]);

	if (held.kind === "opening") return <div className="dsp-pane-note">{t("pane.opening")}</div>;
	if (held.kind === "failed") {
		return (
			<div className="dsp-pane-note">
				<span>{t("pane.failed")}</span>
				<Button size="sm" onClick={onRetry}>
					{t("pane.retry")}
				</Button>
			</div>
		);
	}
	return (
		<SessionProvider session={held.reference}>{renderSlot(PANE_SLOT, { paneId })}</SessionProvider>
	);
}

/** Local `views` slot of `conversation.content`: the chat view only, no view tabs. */
function FixedChat(props: { readonly renderSlot: RootSlotProps["renderSlot"] }): ReactNode {
	return props.renderSlot("conversation.session", { view: "chat" });
}

/**
 * The pane slot's entry (session scope): the host's own conversation, embedded. A blank Session
 * renders the shipped new-session surface (`hero`), so the pane asks for project and mode with the
 * host's own Workspace and agent-mode chips above the host's own composer, exactly like the main
 * new-session page. The chips act through the host's main selection; the controller follows that
 * selection into the focused pane, which is the pane the user clicked to reach the chip.
 */
export function PaneBody({
	sessionId,
	useSession,
	useConversation,
	useSessions,
	renderFactorySlot,
}: SessionSlotProps): ReactNode {
	const session = useSession((snapshot) => snapshot);
	const conversation = useConversation((snapshot) => snapshot);
	const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank);
	const phase = panePhase(session, conversation, summaryBlank);
	return (
		<div className="dsp-pane-content" data-split-pane-body="">
			{renderFactorySlot(
				"conversation.content",
				// `hero` is what puts the shipped new-session surface in the pane: the Workspace
				// chip, the agent-mode chip and the composer. It is only correct while the Session
				// is blank; an existing conversation keeps the plain composer.
				{ variant: "embedded", phase, hero: phase === "hero" },
				{ slots: { views: FixedChat } },
			)}
		</div>
	);
}
