// The layout phase of an embedded conversation, derived the way the host's main conversation
// derives it (`ConversationMainPanel` and `conversationPhase` in dsh-client-ui-conversation
// 0.2.1-rc.1). A blank Session needs `hero`, which centres its composer; under `active` the
// composer of an empty conversation sits at the top of the pane.

/** The Session snapshot fields the phase reads. */
export interface PhaseSession {
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

/** The Conversation snapshot fields the phase reads. */
export interface PhaseConversation {
	readonly activeTargets: { readonly size: number };
}

export type PanePhase = "settling" | "hero" | "active";

/**
 * @param session - the pane's Session snapshot, when bound.
 * @param conversation - the pane's Conversation snapshot, when bound.
 * @param summaryBlank - the Session list's `blank` flag for the Session.
 */
export function panePhase(
	session: PhaseSession | undefined,
	conversation: PhaseConversation | undefined,
	summaryBlank: boolean | undefined,
): PanePhase {
	const blank =
		session === undefined ||
		conversation === undefined ||
		!(
			conversation.activeTargets.size > 0 ||
			(!session.blank && !session.awaitingFirstTurn) ||
			session.running ||
			session.promptAttempted === true
		);
	const openState = session?.openState;
	const parentPending =
		session?.subagent?.address.mode === "continuable" &&
		session.subagent.parentAvailable === undefined;
	if ((blank && openState === "loading" && summaryBlank !== true) || parentPending)
		return "settling";
	if (blank && (openState === "open" || summaryBlank === true)) return "hero";
	return "active";
}
