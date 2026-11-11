import { useMemo } from "react";

export interface CodeTextProps {
	readonly text: string;
	/** Show a line-number gutter. */
	readonly lineNumbers?: boolean;
	/** Number of the first line (default 1). */
	readonly startLine?: number;
	readonly className?: string;
}

/** Monospace block without syntax highlighting; long lines scroll horizontally. */
export function CodeText({ text, lineNumbers = false, startLine = 1, className }: CodeTextProps) {
	const lines = useMemo(() => {
		const split = text.replace(/\r\n/g, "\n").split("\n");
		if (split.length > 1 && split.at(-1) === "") split.pop();
		return split;
	}, [text]);
	const classes = ["rf-code", lineNumbers ? "rf-code--numbered" : "", className ?? ""]
		.filter((part) => part !== "")
		.join(" ");
	return (
		<pre className={classes}>
			<code>
				{lines.map((line, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a line's position is its identity
					<span key={index} className="rf-code-line">
						{lineNumbers ? (
							<span className="rf-code-num" aria-hidden="true">
								{startLine + index}
							</span>
						) : null}
						<span className="rf-code-text">{line}</span>
						{"\n"}
					</span>
				))}
			</code>
		</pre>
	);
}
