// The persisted layout: a versioned JSON record validated on read. Storage is an untrusted
// boundary, so every field is checked: ratios are clamped, panes whose Session is gone are pruned
// and their splits collapse, duplicate Sessions keep their first pane, and focus falls back to
// the first surviving pane (herdr `persist/restore.rs` rules, plus the ratio validation herdr
// lacks).
import {
	clampRatio,
	findPane,
	type LayoutState,
	MAX_PANES,
	type PaneId,
	type PaneNode,
	paneCount,
	panes,
	type SessionId,
} from "./tree.ts";

export const STORAGE_KEY = "dsh-split.layout";
export const STORAGE_VERSION = 1;
/** Recursion guard while reading; any tree within the pane limit is far shallower. */
const MAX_DEPTH = 16;

interface StoredRecord {
	readonly version: typeof STORAGE_VERSION;
	readonly root: PaneNode;
	readonly focus: PaneId;
}

export function serializeLayout(state: LayoutState): string {
	const record: StoredRecord = { version: STORAGE_VERSION, root: state.root, focus: state.focus };
	return JSON.stringify(record);
}

/**
 * Parse a stored record against the Sessions that exist now.
 * @param raw - the stored string, or `null` when nothing is stored.
 * @param known - Sessions in the host list.
 * @returns a layout with at least two panes, or `undefined` when nothing usable remains.
 */
export function parseLayout(
	raw: string | null,
	known: ReadonlySet<SessionId>,
): LayoutState | undefined {
	if (raw === null) return undefined;
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (!isRecord(value) || value.version !== STORAGE_VERSION) return undefined;
	const seenIds = new Set<PaneId>();
	const seenSessions = new Set<SessionId>();
	const revive = (input: unknown, depth: number): PaneNode | undefined => {
		if (!isRecord(input) || depth > MAX_DEPTH) return undefined;
		if (input.kind === "pane") {
			const { id, sessionId } = input;
			if (typeof id !== "string" || id === "" || seenIds.has(id)) return undefined;
			if (sessionId !== undefined && typeof sessionId !== "string") return undefined;
			if (sessionId !== undefined && (!known.has(sessionId) || seenSessions.has(sessionId)))
				return undefined;
			seenIds.add(id);
			if (sessionId !== undefined) seenSessions.add(sessionId);
			return { kind: "pane", id, sessionId };
		}
		if (input.kind !== "split" || (input.axis !== "row" && input.axis !== "column"))
			return undefined;
		const first = revive(input.first, depth + 1);
		const second = revive(input.second, depth + 1);
		if (first === undefined) return second;
		if (second === undefined) return first;
		const ratio = typeof input.ratio === "number" ? clampRatio(input.ratio) : 0.5;
		return { kind: "split", axis: input.axis, ratio, first, second };
	};
	const root = revive(value.root, 0);
	if (root === undefined || paneCount(root) < 2 || paneCount(root) > MAX_PANES) return undefined;
	const focus =
		typeof value.focus === "string" && findPane(root, value.focus) !== undefined
			? value.focus
			: (panes(root)[0]?.id as PaneId);
	return { root, focus, previous: undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
