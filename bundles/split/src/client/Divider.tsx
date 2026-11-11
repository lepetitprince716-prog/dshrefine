// A resize handle on the boundary between two panes. It sits in the gap between the pane cards,
// shows a pill while hovered, focused or dragged, takes the arrow keys, and evens the panes of
// its run on a double click.
import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useRef,
	useState,
} from "react";
import { type DividerBox, ratioFromPointer } from "../layout/geometry.ts";
import type { Translate } from "./locale.ts";

/** Hit area across the boundary, in px: the gap between cards plus a little of each card. */
const DIVIDER_HIT = 10;
const KEY_STEP = 0.05;

export interface DividerProps {
	readonly divider: DividerBox;
	/** Offset of the geometry's origin inside the surface, in px. */
	readonly origin: number;
	/** Ratios that keep every card on both sides at its minimum size, when they exist. */
	readonly bounds: readonly [number, number] | undefined;
	readonly onRatio: (ratio: number) => void;
	readonly onBalance: () => void;
	readonly onResizing: (resizing: boolean) => void;
	readonly t: Translate;
}

export function Divider({
	divider,
	origin,
	bounds,
	onRatio,
	onBalance,
	onResizing,
	t,
}: DividerProps): ReactNode {
	const grab = useRef<number | null>(null);
	const emit = (ratio: number): void =>
		onRatio(bounds === undefined ? ratio : Math.min(Math.max(ratio, bounds[0]), bounds[1]));
	const [active, setActive] = useState(false);
	const row = divider.axis === "row";
	const { area, offset } = divider;
	const style: CSSProperties = row
		? {
				left: origin + area.left + offset - DIVIDER_HIT / 2,
				top: origin + area.top,
				width: DIVIDER_HIT,
				height: area.height,
			}
		: {
				left: origin + area.left,
				top: origin + area.top + offset - DIVIDER_HIT / 2,
				width: area.width,
				height: DIVIDER_HIT,
			};

	/** Pointer position along the axis, in geometry coordinates. */
	const local = (event: PointerEvent<HTMLDivElement>): number => {
		const surface = event.currentTarget.parentElement?.getBoundingClientRect();
		return row
			? event.clientX - (surface?.left ?? 0) - origin
			: event.clientY - (surface?.top ?? 0) - origin;
	};
	const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
		if (event.button !== 0) return;
		// preventDefault keeps text selection out of the drag but also skips focusing, so focus
		// explicitly: the arrow keys work right after a click.
		event.preventDefault();
		event.currentTarget.focus();
		event.currentTarget.setPointerCapture(event.pointerId);
		grab.current = local(event) - ((row ? area.left : area.top) + offset);
		setActive(true);
		onResizing(true);
	};
	const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
		if (grab.current === null) return;
		emit(ratioFromPointer(divider, local(event), grab.current));
	};
	const end = (event: PointerEvent<HTMLDivElement>): void => {
		if (grab.current === null) return;
		grab.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		setActive(false);
		onResizing(false);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		const back = row ? "ArrowLeft" : "ArrowUp";
		const forward = row ? "ArrowRight" : "ArrowDown";
		let next: number | undefined;
		if (event.key === back) next = divider.ratio - KEY_STEP;
		else if (event.key === forward) next = divider.ratio + KEY_STEP;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = 1;
		else if (event.key === "Enter") {
			event.preventDefault();
			onBalance();
			return;
		}
		if (next === undefined) return;
		event.preventDefault();
		emit(next);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a focusable window splitter has no native element.
		<div
			className="dsp-divider"
			data-axis={divider.axis}
			data-active={active ? "" : undefined}
			role="separator"
			aria-orientation={row ? "vertical" : "horizontal"}
			aria-label={t("divider.label")}
			aria-valuemin={10}
			aria-valuemax={90}
			aria-valuenow={Math.round(divider.ratio * 100)}
			tabIndex={0}
			style={style}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={end}
			onPointerCancel={end}
			onDoubleClick={onBalance}
			onKeyDown={onKeyDown}
		/>
	);
}
