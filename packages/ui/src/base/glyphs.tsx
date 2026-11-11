// Private glyphs for kit controls (close, chevron, check, dash). Decorative only; the
// accessible name always comes from the control. They follow the icon grid of DESIGN 3:
// 16px box, 1.5px stroke, currentColor.

function Glyph({ d, size = 16 }: { readonly d: string; readonly size?: number }) {
	return (
		<svg
			className="rf-glyph"
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			<path d={d} />
		</svg>
	);
}

export const CloseGlyph = ({ size }: { readonly size?: number }) => (
	<Glyph d="M4.5 4.5l7 7M11.5 4.5l-7 7" {...(size === undefined ? {} : { size })} />
);
export const ChevronDownGlyph = ({ size }: { readonly size?: number }) => (
	<Glyph d="M4.5 6.25L8 9.75l3.5-3.5" {...(size === undefined ? {} : { size })} />
);
export const ChevronRightGlyph = ({ size }: { readonly size?: number }) => (
	<Glyph d="M6.25 4.5L9.75 8l-3.5 3.5" {...(size === undefined ? {} : { size })} />
);
export const CheckGlyph = ({ size }: { readonly size?: number }) => (
	<Glyph d="M3.75 8.25l2.75 2.75 5.75-6" {...(size === undefined ? {} : { size })} />
);
export const DashGlyph = ({ size }: { readonly size?: number }) => (
	<Glyph d="M4.5 8h7" {...(size === undefined ? {} : { size })} />
);
