// The drop surface over one pane, or over the main conversation while no split is open. It is
// mounted only while a split drag is in progress and stays transparent until the pointer is over
// it; then a rounded box previews the part the drop takes and a chip names the result. The box
// morphs between zones (lehhair/dsh-split-panes `PaneDropOverlay.tsx`, BSD-3-Clause, rewritten).
import { type CSSProperties, type DragEvent, type ReactNode, useState } from "react";
import { type DropZone, resolveDropZone } from "../layout/drop.ts";
import type { Rect } from "../layout/geometry.ts";
import type { Side } from "../layout/tree.ts";
import { type DropPlan, type DropTarget, planZone, type SplitController } from "./controller.ts";
import { type DragState, dropEffectFor, isSplitDrag, settleHostReorder } from "./drag.ts";
import { ZoneGlyph } from "./glyphs.tsx";
import type { MessageKey, Translate } from "./locale.ts";

/** Gap between the preview box and the surface edge, and between the halves, in px. */
const HINT_INSET = 6;

const SIDE_LABELS = {
	move: {
		left: "drop.move.left",
		right: "drop.move.right",
		top: "drop.move.top",
		bottom: "drop.move.bottom",
	},
	session: {
		left: "drop.session.left",
		right: "drop.session.right",
		top: "drop.session.top",
		bottom: "drop.session.bottom",
	},
	new: {
		left: "drop.new.left",
		right: "drop.new.right",
		top: "drop.new.top",
		bottom: "drop.new.bottom",
	},
	empty: {
		left: "drop.empty.left",
		right: "drop.empty.right",
		top: "drop.empty.top",
		bottom: "drop.empty.bottom",
	},
} as const satisfies Record<string, Record<Side, MessageKey>>;

export function dropLabel(plan: DropPlan): MessageKey {
	switch (plan.kind) {
		case "swap":
			return "drop.swap";
		case "move":
			return SIDE_LABELS.move[plan.side];
		case "assign":
			return "drop.here";
		case "create":
			return "drop.newHere";
		case "insert":
		case "splitMain":
			return SIDE_LABELS[plan.content.kind][plan.side];
		case "open":
			return "drop.open";
		case "openNew":
			return "drop.openNew";
		case "full":
			return "drop.full";
	}
}

/** The preview box of a zone inside a surface of the given size. */
export function hintBox(zone: DropZone, width: number, height: number): Rect {
	const inner = {
		left: HINT_INSET,
		top: HINT_INSET,
		width: width - 2 * HINT_INSET,
		height: height - 2 * HINT_INSET,
	};
	const halfWidth = (width - 3 * HINT_INSET) / 2;
	const halfHeight = (height - 3 * HINT_INSET) / 2;
	switch (zone) {
		case "center":
			return inner;
		case "left":
			return { ...inner, width: halfWidth };
		case "right":
			return { ...inner, left: width - HINT_INSET - halfWidth, width: halfWidth };
		case "top":
			return { ...inner, height: halfHeight };
		case "bottom":
			return { ...inner, top: height - HINT_INSET - halfHeight, height: halfHeight };
	}
}

interface Hint {
	readonly zone: DropZone;
	readonly label: MessageKey;
	readonly full: boolean;
	readonly width: number;
	readonly height: number;
}

const sameHint = (a: Hint | null, b: Hint | null): boolean =>
	a === b ||
	(a !== null &&
		b !== null &&
		a.zone === b.zone &&
		a.label === b.label &&
		a.width === b.width &&
		a.height === b.height);

export interface DropLayerProps {
	readonly target: DropTarget;
	readonly controller: SplitController;
	readonly drag: DragState;
	readonly t: Translate;
	readonly className?: string;
	readonly style?: CSSProperties;
}

export function DropLayer({
	target,
	controller,
	drag,
	t,
	className,
	style,
}: DropLayerProps): ReactNode {
	const [hint, setHint] = useState<Hint | null>(null);

	const plan = (event: DragEvent<HTMLDivElement>): DropPlan | null => {
		const box = event.currentTarget.getBoundingClientRect();
		const zone = resolveDropZone(
			event.clientX - box.left,
			event.clientY - box.top,
			box.width,
			box.height,
			drag.payload.kind !== "empty",
		);
		const next = zone === null ? null : controller.planDrop(target, drag.payload, zone);
		const nextHint: Hint | null =
			next === null
				? null
				: {
						zone: planZone(next),
						label: dropLabel(next),
						full: next.kind === "full",
						width: Math.round(box.width),
						height: Math.round(box.height),
					};
		setHint((current) => (sameHint(current, nextHint) ? current : nextHint));
		return next;
	};

	const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
		if (!isSplitDrag([...event.dataTransfer.types])) return;
		const next = plan(event);
		if (next === null || next.kind === "full") {
			event.dataTransfer.dropEffect = "none";
			return;
		}
		event.preventDefault();
		event.dataTransfer.dropEffect = dropEffectFor(event.dataTransfer.effectAllowed);
	};

	const onDragEnter = (event: DragEvent<HTMLDivElement>): void => {
		if (!isSplitDrag([...event.dataTransfer.types])) return;
		// The host commits a reorder onto the last row a sidebar drag hovered; point it back at the
		// dragged row, where the commit does nothing.
		if (drag.payload.kind === "session") settleHostReorder(drag.source);
		onDragOver(event);
	};

	const onDragLeave = (event: DragEvent<HTMLDivElement>): void => {
		const next = event.relatedTarget;
		if (next instanceof Node && event.currentTarget.contains(next)) return;
		setHint(null);
	};

	const onDrop = (event: DragEvent<HTMLDivElement>): void => {
		if (!isSplitDrag([...event.dataTransfer.types])) return;
		event.preventDefault();
		setHint(null);
		const box = event.currentTarget.getBoundingClientRect();
		const zone = resolveDropZone(
			event.clientX - box.left,
			event.clientY - box.top,
			box.width,
			box.height,
			drag.payload.kind !== "empty",
		);
		if (zone !== null) controller.drop(target, drag.payload, zone);
	};

	const box = hint === null ? null : hintBox(hint.zone, hint.width, hint.height);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: a drop target receives drag events only; the menu item, header buttons and shortcuts cover the keyboard.
		<div
			className={className === undefined ? "dsp-drop" : `dsp-drop ${className}`}
			style={style}
			data-drop-target={target.kind === "pane" ? target.paneId : "main"}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			{hint === null || box === null ? null : (
				<div
					className="dsp-drop-hint"
					data-full={hint.full ? "" : undefined}
					style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
				>
					<span className="dsp-drop-chip" key={hint.label}>
						<ZoneGlyph zone={hint.zone} />
						{t(hint.label)}
					</span>
				</div>
			)}
		</div>
	);
}
