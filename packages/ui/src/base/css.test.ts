import { describe, expect, test } from "bun:test";
import { TOKEN_VALUES } from "../tokens.ts";
import { BASE_CSS } from "./css.ts";

const LOCAL_PROPERTIES = new Set(["--rf-tree-level"]);

describe("BASE_CSS", () => {
	test("references only defined --refine-* aliases or local counters", () => {
		const used = [...BASE_CSS.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1] ?? "");
		expect(used.length).toBeGreaterThan(50);
		const unknown = used.filter((name) => !(name in TOKEN_VALUES) && !LOCAL_PROPERTIES.has(name));
		expect(unknown).toEqual([]);
	});

	test("contains no literal colours", () => {
		expect(/#[0-9a-f]{3,8}\b/i.test(BASE_CSS)).toBe(false);
		expect(/\b(rgb|rgba|hsl|hsla|oklch|lab)\(/i.test(BASE_CSS)).toBe(false);
		expect(/(?<![-\w])(white|black)(?![-\w])/.test(BASE_CSS)).toBe(false);
	});

	test("uses only rf- class names", () => {
		const classes = [...BASE_CSS.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((match) => match[1] ?? "");
		const foreign = classes.filter((name) => !name.startsWith("rf-") && !/^\d/.test(name));
		expect(foreign).toEqual([]);
	});

	test("stills every animation under prefers-reduced-motion", () => {
		const reduced = BASE_CSS.slice(BASE_CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
		for (const animated of [
			".rf-status-dot",
			".rf-spinner",
			".rf-skeleton",
			".rf-toast",
			".rf-disclosure-panel",
		]) {
			expect(reduced).toContain(animated);
		}
		expect(BASE_CSS).toContain(
			'.rf-status-dot[data-status="running"]{background:var(--refine-business);animation:rf-breathe 1.2s',
		);
	});

	test("small segments reach a 24 px target through the container padding", () => {
		expect(BASE_CSS).toContain(
			'.rf-segmented-sm .rf-segment::after{content:"";position:absolute;inset:-2px 0;}',
		);
	});

	test("the overlay root is click-through, stacks above the host panels, and its layers opt back in", () => {
		expect(BASE_CSS).toContain(
			".rf-overlay{position:fixed;inset:0;z-index:var(--refine-z-overlay);pointer-events:none;}",
		);
		expect(BASE_CSS).toContain(
			".rf-overlay .rf-layer,.rf-overlay .rf-modal-mask,.rf-overlay .rf-toast{pointer-events:auto;}",
		);
	});

	test("field hover borders never outrank the focus, open or error borders", () => {
		// `:where()` keeps hover at one class of specificity; `:focus`, `[aria-expanded]` and
		// `[aria-invalid]` rules have two, so they win while the pointer rests on the field.
		expect(BASE_CSS).toContain(
			".rf-input:where(:hover:not(:disabled)),.rf-textarea:where(:hover:not(:disabled)),.rf-select:where(:hover:not(:disabled)){border-color:var(--refine-border-4);}",
		);
		expect(BASE_CSS).not.toMatch(/\.rf-(input|textarea|select):hover/);
	});

	test("modal footer buttons wrap to a new line instead of shrinking", () => {
		expect(BASE_CSS).toContain(".rf-modal-footer{display:flex;flex-wrap:wrap;");
		expect(BASE_CSS).toContain(".rf-modal-footer>.rf-btn{flex:none;max-width:100%;}");
	});

	test("the switch follows dsh: brand track and foreground thumb when on", () => {
		expect(BASE_CSS).toContain(
			'.rf-switch[aria-checked="true"] .rf-switch-track{background:var(--refine-switch-on);}',
		);
		expect(BASE_CSS).toContain(
			'.rf-switch[aria-checked="true"] .rf-switch-thumb{transform:translateX(12px);background:var(--refine-text-on-accent);}',
		);
	});

	test("never combines an elevation token with a border in one rule", () => {
		const rules = BASE_CSS.split("}").filter((rule) => rule.includes("--refine-elevation-"));
		for (const rule of rules) expect(rule).not.toMatch(/border:[^;]*var\(--refine-border-/);
	});
});
