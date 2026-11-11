/**
 * Self-drawn icon set (docs/ui/DESIGN.md section 3): a 16px grid, 1.5px strokes in
 * `currentColor`, round caps and joins. A string is a path `d`; `c` is a circle
 * `[cx, cy, r]`, filled when `fill` is set; `r` is a rect `[x, y, width, height, radius]`.
 */
type Shape =
	| string
	| { readonly c: readonly [number, number, number]; readonly fill?: true }
	| { readonly r: readonly [number, number, number, number, number] };

const FILE_OUTLINE =
	"M4.5 1.5H9L12.5 5v8a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 13V3a1.5 1.5 0 0 1 1.5-1.5z";
const FILE_FOLD = "M9 1.5V5h3.5";
const BUBBLE =
	"M2.5 4A1.5 1.5 0 0 1 4 2.5h8A1.5 1.5 0 0 1 13.5 4v6a1.5 1.5 0 0 1-1.5 1.5H7.5L4.5 14v-2.5A1.5 1.5 0 0 1 2.5 10z";

const SHAPES = {
	branch: [
		{ c: [5, 3.5, 1.5] },
		{ c: [5, 12.5, 1.5] },
		{ c: [11, 4.5, 1.5] },
		"M5 5v6",
		"M11 6v.5a3 3 0 0 1-3 3H7a2 2 0 0 0-2 2",
	],
	folder: [
		"M2 4.5A1.5 1.5 0 0 1 3.5 3h3L8 4.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z",
	],
	"folder-open": [
		"M2 11.5v-7A1.5 1.5 0 0 1 3.5 3h3L8 4.5h3.5A1.5 1.5 0 0 1 13 6v1",
		"M2 11.5l1.6-3.6A1.5 1.5 0 0 1 5 7h8.4a.75.75 0 0 1 .7 1l-1.5 4A1.5 1.5 0 0 1 11.2 13H3.5A1.5 1.5 0 0 1 2 11.5z",
	],
	plus: ["M8 3v10", "M3 8h10"],
	close: ["M4 4l8 8", "M12 4l-8 8"],
	check: ["M3 8.5l3 3 7-7"],
	"check-circle": [{ c: [8, 8, 6] }, "M5.5 8.2l1.8 1.8 3.2-3.5"],
	circle: [{ c: [8, 8, 5.5] }],
	"circle-dot": [{ c: [8, 8, 5.5] }, { c: [8, 8, 2], fill: true }],
	play: ["M5 3.5v9l7-4.5z"],
	pause: ["M5.5 3.5v9", "M10.5 3.5v9"],
	trash: [
		"M2.5 4.5h11",
		"M6 4.5V3h4v1.5",
		"M4 4.5l.7 8.1A1.5 1.5 0 0 0 6.2 14h3.6a1.5 1.5 0 0 0 1.5-1.4l.7-8.1",
		"M6.75 7v4.5",
		"M9.25 7v4.5",
	],
	edit: ["M10.5 2.5l3 3L6 13H3v-3z", "M9 4l3 3"],
	comment: [BUBBLE],
	"comment-plus": [BUBBLE, "M8 4.5V9", "M5.75 6.75h4.5"],
	diff: ["M8 2.5v5", "M5.5 5h5", "M5.5 11h5", "M3.5 14h9"],
	file: [FILE_OUTLINE, FILE_FOLD],
	"file-plus": [FILE_OUTLINE, FILE_FOLD, "M7.75 7.5V12", "M5.5 9.75H10"],
	"file-minus": [FILE_OUTLINE, FILE_FOLD, "M5.5 9.75H10"],
	"chevron-right": ["M6 3.5l4.5 4.5L6 12.5"],
	"chevron-down": ["M3.5 6L8 10.5 12.5 6"],
	more: [
		{ c: [3.5, 8, 1.1], fill: true },
		{ c: [8, 8, 1.1], fill: true },
		{ c: [12.5, 8, 1.1], fill: true },
	],
	refresh: ["M13 8a5 5 0 1 1-1.46-3.54", "M13 2.5v3h-3"],
	external: [
		"M9.5 2.5h4v4",
		"M13.5 2.5L8 8",
		"M7 3.5H4A1.5 1.5 0 0 0 2.5 5v7A1.5 1.5 0 0 0 4 13.5h7a1.5 1.5 0 0 0 1.5-1.5V9",
	],
	"git-pr": [
		{ c: [4.5, 3.5, 1.5] },
		{ c: [4.5, 12.5, 1.5] },
		{ c: [11.5, 12.5, 1.5] },
		"M4.5 5v6",
		"M11.5 11V6.5a2 2 0 0 0-2-2h-2",
		"M9 3L7.5 4.5 9 6",
	],
	"git-commit": [{ c: [8, 8, 2.5] }, "M1.5 8h4", "M10.5 8h4"],
	"git-merge": [
		{ c: [4.5, 3.5, 1.5] },
		{ c: [4.5, 12.5, 1.5] },
		{ c: [11.5, 8, 1.5] },
		"M4.5 5v6",
		"M4.5 5a3 3 0 0 0 3 3H10",
	],
	spec: [{ r: [3, 2, 10, 12, 1.5] }, "M5.75 5.5h4.5", "M5.75 8h4.5", "M5.75 10.5h2.5"],
	plan: [
		"M2.5 4l1 1 2-2",
		"M7.5 4h6",
		"M2.5 8.5l1 1 2-2",
		"M7.5 8.5h6",
		"M3 12.5h2",
		"M7.5 12.5h6",
	],
	shelf: [
		{ r: [2, 2.5, 12, 3.5, 1] },
		"M3 6v6.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6",
		"M6.5 9h3",
	],
	warning: [
		"M7.13 2.5a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5h-11a1 1 0 0 1-.87-1.5z",
		"M8 6.25v3",
		{ c: [8, 11.25, 0.8], fill: true },
	],
	info: [{ c: [8, 8, 6] }, "M8 7.5V11", { c: [8, 5.25, 0.8], fill: true }],
	send: ["M14 2L7 9", "M14 2L9.5 14 7 9 2 6.5z"],
	search: [{ c: [7, 7, 4.5] }, "M10.5 10.5l3 3"],
	filter: ["M2.5 3.5h11l-4.25 5v4.5l-2.5-1.25V8.5z"],
	eye: ["M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z", { c: [8, 8, 2] }],
	copy: [
		{ r: [5.5, 5.5, 8, 8, 1.5] },
		"M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5",
	],
	sparkle: [
		"M7 2.5c.4 2.9 1.6 4.1 4.5 4.5-2.9.4-4.1 1.6-4.5 4.5-.4-2.9-1.6-4.1-4.5-4.5 2.9-.4 4.1-1.6 4.5-4.5z",
		"M12.5 10.5v3",
		"M11 12h3",
	],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof SHAPES;

/** Every icon name, in declaration order. */
export const ICON_NAMES = Object.keys(SHAPES) as readonly IconName[];

export interface IconProps {
	readonly name: IconName;
	/** Rendered width and height in px; the drawing stays on its 16px grid. */
	readonly size?: number;
	/** Accessible name. Without it the icon is decorative and hidden from assistive technology. */
	readonly label?: string;
	readonly className?: string;
}

function renderShape(shape: Shape, index: number) {
	if (typeof shape === "string") return <path key={index} d={shape} />;
	if ("c" in shape) {
		const [cx, cy, r] = shape.c;
		return shape.fill ? (
			<circle key={index} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
		) : (
			<circle key={index} cx={cx} cy={cy} r={r} />
		);
	}
	const [x, y, width, height, rx] = shape.r;
	return <rect key={index} x={x} y={y} width={width} height={height} rx={rx} />;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
	const shapes: readonly Shape[] = SHAPES[name];
	const common = {
		className: className === undefined ? "rf-icon" : `rf-icon ${className}`,
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.5,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		focusable: "false",
		"data-icon": name,
	} as const;
	if (label === undefined) {
		return (
			<svg {...common} aria-hidden="true">
				{shapes.map(renderShape)}
			</svg>
		);
	}
	return (
		<svg {...common} role="img" aria-label={label}>
			{shapes.map(renderShape)}
		</svg>
	);
}
