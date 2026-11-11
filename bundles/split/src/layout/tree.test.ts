// Cases adapted from rainfd/dsh-split-pane `tests/layout.client.spec.ts` (MIT) and herdr
// `src/layout.rs` tests (Apache-2.0, close-focus history and split), rewritten for id-addressed
// panes.
import { describe, expect, it } from "bun:test";
import { layoutGeometry } from "./geometry.ts";
import {
	assignSession,
	balanceAll,
	balanceRun,
	clampRatio,
	closePane,
	cyclePane,
	findPane,
	focusPane,
	isValidState,
	type LayoutState,
	leaf,
	MAX_PANES,
	movePane,
	nodeAt,
	type PaneNode,
	paneCount,
	paneOfSession,
	panes,
	removePane,
	setRatioAt,
	sideAxis,
	sideLeads,
	split,
	splitPane,
	swapPanes,
} from "./tree.ts";

/** herdr's fixture shape: row 0.3 [1, column 0.6 [2, row 0.4 [3, 4]]]. */
const sample = (): PaneNode =>
	split(
		"row",
		leaf("1", "s1"),
		split("column", leaf("2", "s2"), split("row", leaf("3", "s3"), leaf("4", "s4"), 0.4), 0.6),
		0.3,
	);

const state = (focus: string, previous?: string, root = sample()): LayoutState => ({
	root,
	focus,
	previous,
});

const ids = (root: PaneNode) => panes(root).map((pane) => pane.id);

/** Pane widths in reading order for a layout `width` pixels wide. */
const widths = (root: PaneNode, width: number) =>
	layoutGeometry(root, width, 100).panes.map((pane) => pane.width);

describe("ratios", () => {
	it("clamps a share into the 0.1-0.9 band", () => {
		expect(clampRatio(0.02)).toBe(0.1);
		expect(clampRatio(0.97)).toBe(0.9);
		expect(clampRatio(0.4)).toBe(0.4);
	});

	it("turns a non-finite share into an even split", () => {
		expect(clampRatio(Number.NaN)).toBe(0.5);
		expect(clampRatio(Number.POSITIVE_INFINITY)).toBe(0.5);
	});

	it("clamps the share a split is built with", () => {
		expect(split("row", leaf("a"), leaf("b"), 0.99).ratio).toBe(0.9);
	});

	it("sets the ratio of the addressed split only", () => {
		const root = setRatioAt(sample(), [1], 0.75);
		expect((nodeAt(root, [1]) as { ratio: number }).ratio).toBe(0.75);
		expect((nodeAt(root, []) as { ratio: number }).ratio).toBe(0.3);
		expect((nodeAt(root, [1, 1]) as { ratio: number }).ratio).toBe(0.4);
	});

	it("leaves the tree alone for a path that is not a split", () => {
		const root = sample();
		expect(setRatioAt(root, [0], 0.7)).toBe(root);
		expect(setRatioAt(root, [1, 1, 1, 1], 0.7)).toBe(root);
	});
});

describe("walking the tree", () => {
	it("lists panes in reading order with their Sessions and paths", () => {
		expect(panes(sample())).toEqual([
			{ id: "1", sessionId: "s1", path: [0] },
			{ id: "2", sessionId: "s2", path: [1, 0] },
			{ id: "3", sessionId: "s3", path: [1, 1, 0] },
			{ id: "4", sessionId: "s4", path: [1, 1, 1] },
		]);
	});

	it("finds a pane by id and the pane showing a Session", () => {
		expect(findPane(sample(), "3")?.sessionId).toBe("s3");
		expect(findPane(sample(), "9")).toBeUndefined();
		expect(paneOfSession(sample(), "s4")).toBe("4");
		expect(paneOfSession(sample(), "s9")).toBeUndefined();
	});

	it("reports nothing for a path that does not resolve", () => {
		expect(nodeAt(sample(), [0, 1])).toBeUndefined();
	});
});

describe("splitting", () => {
	it("replaces the target with a split that keeps the target first", () => {
		const root = splitPane(sample(), "2", "row", leaf("5", "s5")) as PaneNode;
		expect(ids(root)).toEqual(["1", "2", "5", "3", "4"]);
		expect(nodeAt(root, [1, 0])).toMatchObject({ kind: "split", axis: "row", ratio: 0.5 });
	});

	it("keeps untouched subtrees by reference", () => {
		const before = sample();
		const root = splitPane(before, "1", "column", leaf("5")) as PaneNode;
		expect(nodeAt(root, [1])).toBe(nodeAt(before, [1]));
	});

	it("changes nothing for a missing target or an id already present", () => {
		expect(splitPane(sample(), "9", "row", leaf("5"))).toBeUndefined();
		expect(splitPane(sample(), "1", "row", leaf("2"))).toBeUndefined();
	});

	it("refuses to grow past the pane limit", () => {
		let root: PaneNode = leaf("0");
		for (let index = 1; index < MAX_PANES; index++)
			root = splitPane(root, String(index - 1), "row", leaf(String(index))) as PaneNode;
		expect(paneCount(root)).toBe(MAX_PANES);
		expect(splitPane(root, "0", "row", leaf("extra"))).toBeUndefined();
	});

	it("puts the added pane first when it leads", () => {
		const root = splitPane(sample(), "2", "row", leaf("5"), true) as PaneNode;
		expect(ids(root)).toEqual(["1", "5", "2", "3", "4"]);
	});

	it("keeps a balanced run balanced: three and then eight even columns", () => {
		let root: PaneNode = split("row", leaf("a"), leaf("b"));
		root = splitPane(root, "b", "row", leaf("c")) as PaneNode;
		expect(widths(root, 900)).toEqual([300, 300, 300]);
		for (const id of ["d", "e", "f", "g", "h"])
			root = splitPane(root, "a", "row", leaf(id)) as PaneNode;
		expect(widths(root, 800)).toEqual([100, 100, 100, 100, 100, 100, 100, 100]);
	});

	it("only halves the target when the run was resized", () => {
		const root = splitPane(split("row", leaf("a"), leaf("b"), 0.7), "b", "row", leaf("c"));
		expect(widths(root as PaneNode, 1000)).toEqual([700, 150, 150]);
	});

	it("starts a new run for a split on the other axis", () => {
		const before = split("row", leaf("a"), leaf("b"), 0.7);
		const root = splitPane(before, "a", "column", leaf("c")) as PaneNode;
		expect(nodeAt(root, [])).toMatchObject({ ratio: 0.7 });
		expect(nodeAt(root, [0])).toMatchObject({ axis: "column", ratio: 0.5 });
	});

	it("leaves focus and history untouched (herdr split_pane_leaves_focus_and_history_untouched)", () => {
		const before = state("2", "1");
		const root = splitPane(before.root, "2", "row", leaf("5")) as PaneNode;
		const after = { ...before, root };
		expect(after.focus).toBe("2");
		expect(after.previous).toBe("1");
	});
});

describe("removing", () => {
	it("promotes the sibling into the parent's place", () => {
		const root = removePane(sample(), "3") as PaneNode;
		expect(ids(root)).toEqual(["1", "2", "4"]);
		expect(nodeAt(root, [1, 1])).toMatchObject({ kind: "pane", id: "4" });
		expect((nodeAt(root, [1]) as { ratio: number }).ratio).toBe(0.6);
	});

	it("keeps a balanced run balanced after a pane leaves it", () => {
		let root: PaneNode = split("row", leaf("a"), leaf("b"));
		root = splitPane(root, "b", "row", leaf("c")) as PaneNode;
		expect(widths(removePane(root, "b") as PaneNode, 800)).toEqual([400, 400]);
	});

	it("keeps a resized run as it was after a pane leaves it", () => {
		const root = split("row", leaf("a"), split("row", leaf("b"), leaf("c")), 0.2);
		expect(widths(removePane(root, "c") as PaneNode, 1000)).toEqual([200, 800]);
	});

	it("never removes the last pane and ignores unknown ids", () => {
		expect(removePane(leaf("a"), "a")).toBeUndefined();
		expect(removePane(sample(), "9")).toBeUndefined();
	});

	it("points a pane at another Session without touching the others", () => {
		const before = sample();
		const root = assignSession(before, "2", undefined);
		expect(findPane(root, "2")?.sessionId).toBeUndefined();
		expect(nodeAt(root, [0])).toBe(nodeAt(before, [0]));
		expect(assignSession(before, "2", "s2")).toBe(before);
	});
});

describe("moving, swapping and balancing", () => {
	it("maps sides to an axis and an order", () => {
		expect([sideAxis("left"), sideAxis("right"), sideAxis("top"), sideAxis("bottom")]).toEqual([
			"row",
			"row",
			"column",
			"column",
		]);
		expect([sideLeads("left"), sideLeads("right"), sideLeads("top"), sideLeads("bottom")]).toEqual([
			true,
			false,
			true,
			false,
		]);
	});

	it("moves a pane beside another and keeps the moved leaf itself", () => {
		const before = sample();
		const moved = findPane(before, "4");
		const root = movePane(before, "4", "1", "left") as PaneNode;
		expect(ids(root)).toEqual(["4", "1", "2", "3"]);
		expect(findPane(root, "4")).toBe(moved);
		expect(nodeAt(root, [0])).toMatchObject({ kind: "split", axis: "row" });
	});

	it("moves a pane below another", () => {
		const root = movePane(sample(), "1", "3", "bottom") as PaneNode;
		expect(ids(root)).toEqual(["2", "3", "1", "4"]);
		expect(nodeAt(root, [1, 0])).toMatchObject({ kind: "split", axis: "column" });
	});

	it("refuses a move onto itself or with a missing pane", () => {
		expect(movePane(sample(), "2", "2", "left")).toBeUndefined();
		expect(movePane(sample(), "9", "2", "left")).toBeUndefined();
		expect(movePane(sample(), "2", "9", "left")).toBeUndefined();
	});

	it("swaps two panes with their Sessions", () => {
		const root = swapPanes(sample(), "1", "4") as PaneNode;
		expect(panes(root).map((pane) => [pane.id, pane.sessionId])).toEqual([
			["4", "s4"],
			["2", "s2"],
			["3", "s3"],
			["1", "s1"],
		]);
		expect(swapPanes(sample(), "1", "1")).toBeUndefined();
		expect(swapPanes(sample(), "1", "9")).toBeUndefined();
	});

	it("balances the run of one divider and leaves other runs alone", () => {
		const root = balanceRun(sample(), [1, 1]);
		expect(nodeAt(root, [1, 1])).toMatchObject({ ratio: 0.5 });
		expect(nodeAt(root, [1])).toMatchObject({ ratio: 0.6 });
		expect(nodeAt(root, [])).toMatchObject({ ratio: 0.3 });
		expect(balanceRun(sample(), [0])).toEqual(sample());
	});

	it("balances every run", () => {
		const root = balanceAll(sample());
		expect(
			[[], [1], [1, 1]].map((path) => (nodeAt(root, path) as { ratio: number }).ratio),
		).toEqual([0.5, 0.5, 0.5]);
	});
});

describe("close-focus history (herdr)", () => {
	it("returns to the pane focus came from", () => {
		const after = closePane(focusPane(state("1"), "3"), "3") as LayoutState;
		expect(after.focus).toBe("1");
		expect(after.previous).toBeUndefined();
	});

	it("returns to the pane that opened a split", () => {
		const before = state("2");
		const root = splitPane(before.root, "2", "row", leaf("5")) as PaneNode;
		const opened = focusPane({ ...before, root }, "5");
		expect((closePane(opened, "5") as LayoutState).focus).toBe("2");
	});

	it("closing a background pane keeps the focused pane and its history", () => {
		const after = closePane(state("3", "1"), "4") as LayoutState;
		expect(after.focus).toBe("3");
		expect(after.previous).toBe("1");
	});

	it("closing the remembered pane drops the history", () => {
		const after = closePane(state("3", "1"), "1") as LayoutState;
		expect(after.focus).toBe("3");
		expect(after.previous).toBeUndefined();
	});

	it("uses reading order without history: the next pane, else the previous one", () => {
		expect((closePane(state("2"), "2") as LayoutState).focus).toBe("3");
		expect((closePane(state("4"), "4") as LayoutState).focus).toBe("3");
	});

	it("does not reuse the history after it is consumed", () => {
		const first = closePane(focusPane(state("1"), "3"), "3") as LayoutState;
		const second = closePane(first, "1") as LayoutState;
		expect(second.focus).toBe("2");
	});

	it("resizing does not disturb the close target", () => {
		const focused = focusPane(state("1"), "3");
		const resized = { ...focused, root: setRatioAt(focused.root, [1], 0.8) };
		expect((closePane(resized, "3") as LayoutState).focus).toBe("1");
	});

	it("refuses the last pane", () => {
		expect(closePane(state("a", undefined, leaf("a")), "a")).toBeUndefined();
	});
});

describe("focus", () => {
	it("records the pane left behind and ignores unknown or current panes", () => {
		const before = state("1");
		expect(focusPane(before, "4")).toMatchObject({ focus: "4", previous: "1" });
		expect(focusPane(before, "1")).toBe(before);
		expect(focusPane(before, "9")).toBe(before);
	});

	it("cycles through panes in reading order and wraps", () => {
		expect(cyclePane(state("4"), 1)).toBe("1");
		expect(cyclePane(state("1"), -1)).toBe("4");
		expect(cyclePane(state("2"), 1)).toBe("3");
	});

	it("validates unique ids and an existing focus", () => {
		expect(isValidState(state("1"))).toBe(true);
		expect(isValidState(state("9"))).toBe(false);
		expect(isValidState(state("a", undefined, split("row", leaf("a"), leaf("a"))))).toBe(false);
	});
});
