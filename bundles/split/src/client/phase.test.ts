import { describe, expect, it } from "bun:test";
import { type PhaseSession, panePhase } from "./phase.ts";

const blankSession: PhaseSession = {
	blank: true,
	awaitingFirstTurn: true,
	running: false,
	promptAttempted: false,
	openState: "open",
};
const idle = { activeTargets: new Set() };

describe("panePhase", () => {
	it("centres the composer of an open blank Session", () => {
		expect(panePhase(blankSession, idle, true)).toBe("hero");
	});

	it("settles while a blank Session is still loading", () => {
		expect(panePhase({ ...blankSession, openState: "loading" }, idle, false)).toBe("settling");
		expect(panePhase({ ...blankSession, openState: "loading" }, idle, true)).toBe("hero");
	});

	it("is active once the conversation has turns, a prompt or work", () => {
		expect(
			panePhase({ ...blankSession, blank: false, awaitingFirstTurn: false }, idle, false),
		).toBe("active");
		expect(panePhase({ ...blankSession, promptAttempted: true }, idle, true)).toBe("active");
		expect(panePhase({ ...blankSession, running: true }, idle, true)).toBe("active");
		expect(panePhase(blankSession, { activeTargets: new Set(["chat"]) }, true)).toBe("active");
	});

	it("settles a subagent Session until its parent's availability is known", () => {
		const child: PhaseSession = {
			...blankSession,
			blank: false,
			awaitingFirstTurn: false,
			subagent: { address: { mode: "continuable" } },
		};
		expect(panePhase(child, idle, false)).toBe("settling");
		expect(
			panePhase(
				{ ...child, subagent: { address: { mode: "continuable" }, parentAvailable: true } },
				idle,
				false,
			),
		).toBe("active");
	});

	it("treats an unbound Session as blank", () => {
		expect(panePhase(undefined, undefined, true)).toBe("hero");
		expect(panePhase(undefined, undefined, false)).toBe("active");
	});
});
