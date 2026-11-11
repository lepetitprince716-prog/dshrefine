import { type ReactNode, useMemo } from "react";
import { type BlockNode, type InlineNode, parseMarkdown } from "./markdown.ts";

export interface MarkdownLiteProps {
	readonly source: string;
	readonly className?: string;
}

/** Renders the Markdown subset of `markdown.ts`. Text goes through React, never through HTML. */
export function MarkdownLite({ source, className }: MarkdownLiteProps) {
	const blocks = useMemo(() => parseMarkdown(source), [source]);
	return (
		<div className={className === undefined ? "rf-md" : `rf-md ${className}`}>
			{renderBlocks(blocks)}
		</div>
	);
}

function renderBlocks(blocks: readonly BlockNode[]): ReactNode[] {
	return blocks.map((block, index) => renderBlock(block, index));
}

function renderBlock(block: BlockNode, key: number): ReactNode {
	switch (block.type) {
		case "heading": {
			const Tag = `h${block.level}` as const;
			return (
				<Tag key={key} className={`rf-md-h rf-md-h${block.level}`}>
					{renderInline(block.children)}
				</Tag>
			);
		}
		case "paragraph":
			return (
				<p key={key} className="rf-md-p">
					{renderInline(block.children)}
				</p>
			);
		case "code":
			return (
				<pre key={key} className="rf-md-pre" data-lang={block.lang === "" ? undefined : block.lang}>
					<code>{block.value}</code>
				</pre>
			);
		case "list": {
			const items = block.items.map((item, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: items are positional and static per render
				<li key={index} className="rf-md-li">
					{renderItem(item.children)}
				</li>
			));
			return block.ordered ? (
				<ol key={key} className="rf-md-list" start={block.start === 1 ? undefined : block.start}>
					{items}
				</ol>
			) : (
				<ul key={key} className="rf-md-list">
					{items}
				</ul>
			);
		}
	}
}

/** A single-paragraph item renders inline (tight list); richer items keep their blocks. */
function renderItem(children: readonly BlockNode[]): ReactNode {
	const [only] = children;
	if (children.length === 1 && only?.type === "paragraph") return renderInline(only.children);
	return renderBlocks(children);
}

function renderInline(nodes: readonly InlineNode[]): ReactNode[] {
	return nodes.map((node, index) => renderInlineNode(node, index));
}

function renderInlineNode(node: InlineNode, key: number): ReactNode {
	switch (node.type) {
		case "text":
			return node.value;
		case "code":
			return (
				<code key={key} className="rf-md-code">
					{node.value}
				</code>
			);
		case "strong":
			return <strong key={key}>{renderInline(node.children)}</strong>;
		case "em":
			return <em key={key}>{renderInline(node.children)}</em>;
		case "link":
			return (
				<a
					key={key}
					className="rf-md-link"
					href={node.href}
					target="_blank"
					rel="noopener noreferrer"
				>
					{renderInline(node.children)}
				</a>
			);
	}
}
