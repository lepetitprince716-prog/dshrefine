import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, jest, test } from "bun:test";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { CodeText } from "./CodeText.tsx";
import { DATA_CSS } from "./css.ts";
import { DiffStat } from "./DiffStat.tsx";
import { MarkdownLite } from "./MarkdownLite.tsx";
import { nextTickDelay, RelativeTime } from "./RelativeTime.tsx";

const { act, cleanup, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(() => {
	cleanup();
	jest.useRealTimers();
});

describe("MarkdownLite", () => {
	test("renders every construct", () => {
		const source = [
			"# Title",
			"",
			"Some **bold**, *italic* and `code` with a [link](https://example.com).",
			"",
			"- one",
			"- two",
			"",
			"2. second",
			"3. third",
			"",
			"```sh",
			"echo hi",
			"```",
		].join("\n");
		const view = render(<MarkdownLite source={source} />);
		expect(view.getByRole("heading", { level: 1, name: "Title" })).toBeDefined();
		expect(view.container.querySelector("strong")?.textContent).toBe("bold");
		expect(view.container.querySelector("em")?.textContent).toBe("italic");
		expect(view.container.querySelector("code.rf-md-code")?.textContent).toBe("code");
		const link = view.getByRole("link", { name: "link" });
		expect(link.getAttribute("href")).toBe("https://example.com/");
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		expect(view.container.querySelectorAll("ul > li")).toHaveLength(2);
		expect(view.container.querySelector("ol")?.getAttribute("start")).toBe("2");
		const pre = view.container.querySelector("pre.rf-md-pre");
		expect(pre?.getAttribute("data-lang")).toBe("sh");
		expect(pre?.textContent).toBe("echo hi");
	});

	test("hostile input never becomes markup or a link", () => {
		const source = [
			"<script>window.__pwned = true</script>",
			"[click](javascript:alert(1))",
			'<img src=x onerror="window.__pwned = true">',
			"**unbalanced *markers",
		].join("\n\n");
		const view = render(<MarkdownLite source={source} />);
		expect(view.container.querySelector("script, img")).toBeNull();
		expect(view.queryByRole("link")).toBeNull();
		expect(view.container.textContent).toContain("<script>window.__pwned = true</script>");
		expect(view.container.textContent).toContain("[click](javascript:alert(1))");
		expect(view.container.textContent).toContain("**unbalanced *markers");
		expect((globalThis as { __pwned?: boolean }).__pwned).toBeUndefined();
	});
});

describe("RelativeTime", () => {
	test("renders a time element with the absolute value", () => {
		const at = Date.UTC(2026, 9, 17, 12, 0, 0);
		const view = render(
			<RelativeTime
				at={at}
				now={at + 5000}
				format={(delta) => `${Math.round(delta / 1000)}s ago`}
				formatAbsolute={(date) => `abs ${date.toISOString()}`}
			/>,
		);
		const time = view.container.querySelector("time");
		expect(time?.textContent).toBe("5s ago");
		expect(time?.getAttribute("dateTime")).toBe("2026-10-17T12:00:00.000Z");
		expect(time?.getAttribute("title")).toBe("abs 2026-10-17T12:00:00.000Z");
	});

	test("ticks with fake timers", () => {
		jest.useFakeTimers();
		const start = Date.UTC(2026, 9, 17, 12, 0, 0);
		jest.setSystemTime(new Date(start));
		const view = render(
			<RelativeTime at={new Date(start).toISOString()} format={(delta) => `${delta}`} />,
		);
		const label = () => view.container.querySelector("time")?.textContent;
		// Advancing fake timers also advances Date.now().
		expect(label()).toBe("0");
		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(label()).toBe("1000");
		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(label()).toBe("2000");
	});

	test("a fixed now does not tick, an invalid date renders nothing", () => {
		jest.useFakeTimers();
		const view = render(<RelativeTime at={0} now={1000} format={(delta) => `${delta}`} />);
		act(() => {
			jest.advanceTimersByTime(60_000);
		});
		expect(view.container.querySelector("time")?.textContent).toBe("1000");
		cleanup();
		const invalid = render(<RelativeTime at="not a date" format={() => "x"} />);
		expect(invalid.container.querySelector("time")).toBeNull();
	});

	test("tick delay grows with distance", () => {
		expect(nextTickDelay(10_000)).toBe(1000);
		expect(nextTickDelay(-10_000)).toBe(1000);
		expect(nextTickDelay(10 * 60_000)).toBe(15_000);
		expect(nextTickDelay(5 * 3_600_000)).toBe(60_000);
	});
});

describe("CodeText and DiffStat", () => {
	test("CodeText renders lines with optional numbers", () => {
		const view = render(<CodeText text={"a\r\nb\n"} lineNumbers startLine={9} />);
		const lines = view.container.querySelectorAll(".rf-code-line");
		expect(lines).toHaveLength(2);
		const numbers = Array.from(view.container.querySelectorAll(".rf-code-num"));
		expect(numbers.map((node) => node.textContent)).toEqual(["9", "10"]);
		expect(numbers[0]?.getAttribute("aria-hidden")).toBe("true");
		cleanup();
		const plain = render(<CodeText text="<b>x</b>" />);
		expect(plain.container.querySelector(".rf-code-num, b")).toBeNull();
		expect(plain.container.textContent).toBe("<b>x</b>\n");
	});

	test("DiffStat shows signed counts and an optional accessible label", () => {
		const view = render(<DiffStat added={12} removed={3} />);
		expect(view.container.textContent).toBe("+12−3");
		cleanup();
		const labelled = render(<DiffStat added={1} removed={0} label="1 addition, 0 deletions" />);
		expect(labelled.getByRole("img", { name: "1 addition, 0 deletions" })).toBeDefined();
	});
});

describe("DATA_CSS", () => {
	test("uses rf- classes and only rail aliases, no literal colours", () => {
		expect(DATA_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(DATA_CSS).not.toMatch(/rgba?\(|hsla?\(/);
		expect(DATA_CSS).not.toContain("--dsw-");
		const customProperties = DATA_CSS.match(/var\(--[\w-]+/g) ?? [];
		for (const reference of customProperties)
			expect(reference.startsWith("var(--refine-")).toBe(true);
		const selectors = DATA_CSS.match(/\.[a-z][\w-]*/g) ?? [];
		for (const selector of selectors) expect(selector.startsWith(".rf-")).toBe(true);
	});
});
