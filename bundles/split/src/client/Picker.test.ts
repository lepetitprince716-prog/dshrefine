import { describe, expect, it } from "bun:test";
import type { SessionListState, SessionSummary } from "../dsh-types.d.ts";
import { pickableSessions } from "./Picker.tsx";

const row = (
	id: string,
	updatedAt: number,
	extra: Partial<SessionSummary> = {},
): SessionSummary => ({
	id,
	displayTitle: `Title ${id}`,
	running: false,
	blank: false,
	updatedAt,
	...extra,
});

const list = (rows: readonly SessionSummary[]): SessionListState => ({
	ids: rows.map((entry) => entry.id),
	byId: Object.fromEntries(rows.map((entry) => [entry.id, entry])),
	phase: "ready",
});

describe("pickableSessions", () => {
	const sessions = list([
		row("a", 1, { cwd: "/work/alpha" }),
		row("b", 3),
		row("child", 4, { origin: "subagent" }),
		row("blank", 5, { blank: true }),
		row("c", 2, { displayTitle: "Fix the parser" }),
	]);

	it("lists newest first and leaves out subagent children, blank and shown Sessions", () => {
		expect(pickableSessions(sessions, new Set(["b"]), "").map((entry) => entry.id)).toEqual([
			"c",
			"a",
		]);
	});

	it("filters by title or directory, ignoring case and surrounding space", () => {
		expect(pickableSessions(sessions, new Set(), " PARSER ").map((entry) => entry.id)).toEqual([
			"c",
		]);
		expect(pickableSessions(sessions, new Set(), "alpha").map((entry) => entry.id)).toEqual(["a"]);
	});
});
