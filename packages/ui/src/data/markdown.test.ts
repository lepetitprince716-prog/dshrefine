import { describe, expect, test } from "bun:test";
import { type BlockNode, parseInline, parseMarkdown, safeHref } from "./markdown.ts";

const text = (value: string) => ({ type: "text" as const, value });

describe("parseMarkdown blocks", () => {
	test("headings 1-6, closing hashes, and non-headings", () => {
		expect(parseMarkdown("# One\n###### Six ##")).toEqual([
			{ type: "heading", level: 1, children: [text("One")] },
			{ type: "heading", level: 6, children: [text("Six")] },
		]);
		expect(parseMarkdown("#hashtag")).toEqual([
			{ type: "paragraph", children: [text("#hashtag")] },
		]);
		expect(parseMarkdown("####### seven")[0]?.type).toBe("paragraph");
	});

	test("paragraphs split on blank lines and keep soft breaks", () => {
		expect(parseMarkdown("a\nb\n\nc")).toEqual([
			{ type: "paragraph", children: [text("a\nb")] },
			{ type: "paragraph", children: [text("c")] },
		]);
		expect(parseMarkdown("")).toEqual([]);
		expect(parseMarkdown("\r\n\r\nx\r\n")).toEqual([{ type: "paragraph", children: [text("x")] }]);
	});

	test("fenced code keeps content verbatim, with language and tilde fences", () => {
		expect(parseMarkdown("```ts\nconst a = **b**;\n<b>x</b>\n```\nafter")).toEqual([
			{ type: "code", lang: "ts", value: "const a = **b**;\n<b>x</b>" },
			{ type: "paragraph", children: [text("after")] },
		]);
		expect(parseMarkdown("~~~\nx\n~~~~")).toEqual([{ type: "code", lang: "", value: "x" }]);
	});

	test("an unclosed fence runs to the end", () => {
		expect(parseMarkdown("```\nopen\nstill")).toEqual([
			{ type: "code", lang: "", value: "open\nstill" },
		]);
	});

	test("unordered lists with tight items and lazy continuation", () => {
		const [list] = parseMarkdown("- one\n- two\ncontinued\n* other list");
		expect(list).toEqual({
			type: "list",
			ordered: false,
			start: 1,
			items: [
				{ children: [{ type: "paragraph", children: [text("one")] }] },
				{ children: [{ type: "paragraph", children: [text("two\ncontinued")] }] },
			],
		});
		expect(parseMarkdown("- one\n- two\ncontinued\n* other list")).toHaveLength(2);
	});

	test("ordered lists keep their start number", () => {
		const [list] = parseMarkdown("3. three\n4) four\n4. four");
		expect(list?.type).toBe("list");
		if (list?.type !== "list") return;
		expect(list.ordered).toBe(true);
		expect(list.start).toBe(3);
		expect(list.items).toHaveLength(1); // "4)" switches delimiter and starts a new list
	});

	test("nested lists and code inside items", () => {
		const [list] = parseMarkdown(
			"- parent\n  - child\n  - child 2\n- next\n\n  ```\n  code\n  ```",
		);
		if (list?.type !== "list") throw new Error("expected a list");
		const first = list.items[0]?.children ?? [];
		expect(first[0]).toEqual({ type: "paragraph", children: [text("parent")] });
		const nested = first[1] as BlockNode;
		expect(nested.type).toBe("list");
		if (nested.type === "list") expect(nested.items).toHaveLength(2);
		expect(list.items[1]?.children.at(-1)).toEqual({ type: "code", lang: "", value: "code" });
	});

	test("a list ends at an unindented paragraph after a blank line", () => {
		const blocks = parseMarkdown("- a\n\nafter");
		expect(blocks.map((block) => block.type)).toEqual(["list", "paragraph"]);
	});

	test("deep nesting stops at the depth cap without throwing", () => {
		const source = Array.from({ length: 200 }, (_, depth) => `${"  ".repeat(depth)}- x`).join("\n");
		expect(() => parseMarkdown(source)).not.toThrow();
	});
});

describe("parseInline", () => {
	test("bold, italic, and nesting", () => {
		expect(parseInline("**b** and *i* and __u__ and _e_")).toEqual([
			{ type: "strong", children: [text("b")] },
			text(" and "),
			{ type: "em", children: [text("i")] },
			text(" and "),
			{ type: "strong", children: [text("u")] },
			text(" and "),
			{ type: "em", children: [text("e")] },
		]);
		expect(parseInline("***both***")).toEqual([
			{ type: "em", children: [{ type: "strong", children: [text("both")] }] },
		]);
		expect(parseInline("**bold *it* bold**")).toEqual([
			{
				type: "strong",
				children: [text("bold "), { type: "em", children: [text("it")] }, text(" bold")],
			},
		]);
	});

	test("unbalanced and spaced markers stay literal", () => {
		expect(parseInline("**open")).toEqual([text("**open")]);
		expect(parseInline("close*")).toEqual([text("close*")]);
		expect(parseInline("a * b * c")).toEqual([text("a * b * c")]);
		expect(parseInline("snake_case_name")).toEqual([text("snake_case_name")]);
		// The nearest opener wins; leftover marker characters stay as text.
		expect(parseInline("*a **b*")).toEqual([text("*a *"), { type: "em", children: [text("b")] }]);
		expect(parseInline("\\*not em\\*")).toEqual([text("*not em*")]);
	});

	test("inline code is literal and wins over emphasis", () => {
		expect(parseInline("use `a*b*c` here")).toEqual([
			text("use "),
			{ type: "code", value: "a*b*c" },
			text(" here"),
		]);
		expect(parseInline("``x ` y``")).toEqual([{ type: "code", value: "x ` y" }]);
		expect(parseInline("` padded `")).toEqual([{ type: "code", value: "padded" }]);
		expect(parseInline("`unclosed")).toEqual([text("`unclosed")]);
	});

	test("links allow only http, https and mailto", () => {
		expect(parseInline("[site](https://example.com/a?b=1)")).toEqual([
			{ type: "link", href: "https://example.com/a?b=1", children: [text("site")] },
		]);
		expect(parseInline("[mail](mailto:a@b.c)")[0]).toEqual({
			type: "link",
			href: "mailto:a@b.c",
			children: [text("mail")],
		});
		expect(parseInline("[**bold** link](http://x.org/(paren))")).toEqual([
			{
				type: "link",
				href: "http://x.org/(paren)",
				children: [{ type: "strong", children: [text("bold")] }, text(" link")],
			},
		]);
	});

	test("hostile links render as text", () => {
		for (const url of [
			"javascript:alert(1)",
			"JaVaScRiPt:alert(1)",
			"data:text/html,<script>alert(1)</script>",
			"vbscript:msgbox",
			"/relative/path",
			"file:///etc/passwd",
		]) {
			const nodes = parseInline(`[x](${url})`);
			expect(nodes.some((node) => node.type === "link")).toBe(false);
			expect(nodes.map((node) => (node.type === "text" ? node.value : "")).join("")).toContain("x");
		}
		expect(
			parseInline("[a [nested](https://a.b)](https://c.d)").filter((n) => n.type === "link"),
		).toHaveLength(1);
		expect(parseInline("[text] (https://a.b)")).toEqual([text("[text] (https://a.b)")]);
	});

	test("raw HTML is plain text", () => {
		expect(parseInline("<script>alert(1)</script>")).toEqual([text("<script>alert(1)</script>")]);
		expect(parseMarkdown("<img src=x onerror=alert(1)>")).toEqual([
			{ type: "paragraph", children: [text("<img src=x onerror=alert(1)>")] },
		]);
	});

	test("pathological input stays fast", () => {
		const started = performance.now();
		parseInline("**a ".repeat(20000));
		parseInline("[".repeat(20000));
		parseInline("`".repeat(5000) + " x ".repeat(5000));
		parseInline("_a ".repeat(20000));
		expect(performance.now() - started).toBeLessThan(2000);
	});
});

describe("safeHref", () => {
	test("normalizes and filters", () => {
		expect(safeHref(" https://a.b ")).toBe("https://a.b/");
		expect(safeHref("java\tscript:alert(1)")).toBeNull();
		expect(safeHref("not a url")).toBeNull();
	});
});
