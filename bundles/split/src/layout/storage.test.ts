// Restore rules follow herdr `src/persist/restore.rs` tests (prune a missing branch, focus falls
// back to the first survivor) plus validation herdr lacks (ratios, duplicates, versions).
import { describe, expect, it } from "bun:test";
import { parseLayout, serializeLayout } from "./storage.ts";
import { type LayoutState, leaf, panes, split } from "./tree.ts";

const known = new Set(["s1", "s2", "s3"]);

const record = (root: unknown, focus: unknown = "a", version: unknown = 1): string =>
	JSON.stringify({ version, root, focus });

describe("layout storage", () => {
	it("round-trips a layout", () => {
		const state: LayoutState = {
			root: split("row", leaf("a", "s1"), split("column", leaf("b", "s2"), leaf("c"), 0.3), 0.6),
			focus: "b",
			previous: "a",
		};
		expect(parseLayout(serializeLayout(state), known)).toEqual({ ...state, previous: undefined });
	});

	it("rejects missing, malformed, foreign-version and non-tree values", () => {
		expect(parseLayout(null, known)).toBeUndefined();
		expect(parseLayout("{", known)).toBeUndefined();
		expect(parseLayout("[]", known)).toBeUndefined();
		const root = split("row", leaf("a", "s1"), leaf("b", "s2"));
		expect(parseLayout(record(root, "a", 2), known)).toBeUndefined();
		expect(parseLayout(record({ kind: "tree" }), known)).toBeUndefined();
	});

	it("prunes panes whose Session is gone and collapses their split", () => {
		const root = split("row", leaf("a", "s1"), split("column", leaf("b", "gone"), leaf("c", "s3")));
		const restored = parseLayout(record(root, "b"), known);
		expect(restored?.root).toEqual(split("row", leaf("a", "s1"), leaf("c", "s3")));
		expect(restored?.focus).toBe("a");
	});

	it("keeps the first pane of a duplicated Session or id", () => {
		const duplicateSession = split(
			"row",
			leaf("a", "s1"),
			split("row", leaf("b", "s1"), leaf("c")),
		);
		expect(
			panes(parseLayout(record(duplicateSession), known)?.root ?? leaf("x")).map((p) => p.id),
		).toEqual(["a", "c"]);
		const duplicateId = split("row", leaf("a", "s1"), split("row", leaf("a", "s2"), leaf("c")));
		expect(
			panes(parseLayout(record(duplicateId), known)?.root ?? leaf("x")).map((p) => p.id),
		).toEqual(["a", "c"]);
	});

	it("drops a layout left with fewer than two panes", () => {
		const root = split("row", leaf("a", "s1"), leaf("b", "gone"));
		expect(parseLayout(record(root), known)).toBeUndefined();
	});

	it("clamps stored ratios and repairs a non-numeric one", () => {
		const root = { ...split("row", leaf("a", "s1"), leaf("b", "s2")), ratio: 7 };
		expect(parseLayout(record(root), known)?.root).toMatchObject({ ratio: 0.9 });
		const text = { ...split("row", leaf("a", "s1"), leaf("b", "s2")), ratio: "wide" };
		expect(parseLayout(record(text), known)?.root).toMatchObject({ ratio: 0.5 });
	});

	it("rejects bad axes and ids", () => {
		const badAxis = { ...split("row", leaf("a", "s1"), leaf("b", "s2")), axis: "diagonal" };
		expect(parseLayout(record(badAxis), known)).toBeUndefined();
		const badId = split("row", leaf("", "s1"), split("row", leaf("b", "s2"), leaf("c")));
		expect(
			panes(parseLayout(record(badId, "b"), known)?.root ?? leaf("x")).map((p) => p.id),
		).toEqual(["b", "c"]);
	});

	it("rejects more panes than the limit (herdr layout_validation_rejects_too_many_panes)", () => {
		let root: unknown = leaf("deep", "s1");
		for (let depth = 0; depth < 20; depth++) root = split("row", leaf(`p${depth}`), root as never);
		expect(parseLayout(record(root, "p0"), known)).toBeUndefined();
	});
});
