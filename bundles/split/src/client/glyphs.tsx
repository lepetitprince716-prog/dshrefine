// Pane header glyphs on the kit's 16px grid (1.5px stroke, currentColor), for actions the kit's
// icon set does not cover.
import type { ReactNode } from "react";

function Glyph({ children }: { readonly children: ReactNode }) {
	return (
		<svg
			className="rf-icon"
			width={14}
			height={14}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			focusable="false"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

export function SplitRightGlyph() {
	return (
		<Glyph>
			<rect x={2.5} y={3} width={11} height={10} rx={1.5} />
			<path d="M8 3v10" />
		</Glyph>
	);
}

export function SplitDownGlyph() {
	return (
		<Glyph>
			<rect x={2.5} y={3} width={11} height={10} rx={1.5} />
			<path d="M2.5 8h11" />
		</Glyph>
	);
}

export function SidebarGlyph() {
	return (
		<Glyph>
			<rect x={2.5} y={3} width={11} height={10} rx={1.5} />
			<path d="M10 3v10" />
		</Glyph>
	);
}

/** The header utility's glyph: the host header's 16px grid and 1px stroke. */
export function HeaderSplitGlyph() {
	return (
		<svg
			className="rf-icon"
			width={16}
			height={16}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1}
			focusable="false"
			aria-hidden="true"
		>
			<path d="M13.5 1.5h-11a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1Z" />
			<path d="M8 1.5v13" />
		</svg>
	);
}

export function MaximizeGlyph() {
	return (
		<Glyph>
			<path d="M3 6.5V3h3.5M13 6.5V3H9.5M3 9.5V13h3.5M13 9.5V13H9.5" />
		</Glyph>
	);
}

export function RestoreGlyph() {
	return (
		<Glyph>
			<path d="M6.5 3v3.5H3M9.5 3v3.5H13M6.5 13V9.5H3M9.5 13V9.5H13" />
		</Glyph>
	);
}

/** A pane outline with the part a drop covers filled: one half, or an inner box for the centre. */
export function ZoneGlyph({
	zone,
}: {
	readonly zone: "left" | "right" | "top" | "bottom" | "center";
}) {
	const fill = {
		left: { x: 2.5, y: 3, width: 5.5, height: 10 },
		right: { x: 8, y: 3, width: 5.5, height: 10 },
		top: { x: 2.5, y: 3, width: 11, height: 5 },
		bottom: { x: 2.5, y: 8, width: 11, height: 5 },
		center: { x: 5, y: 5.5, width: 6, height: 5 },
	}[zone];
	return (
		<Glyph>
			<rect x={2.5} y={3} width={11} height={10} rx={1.5} />
			<rect {...fill} rx={1} fill="currentColor" stroke="none" opacity={0.85} />
		</Glyph>
	);
}
