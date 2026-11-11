// One pane at a time: below the minimum pane size, or while a pane is maximized, the panes sit
// behind a strip of pills and only the chosen one is shown.
import { Button, StatusDot } from "@refine/ui";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import type { PaneId, SessionId } from "../layout/tree.ts";
import { RestoreGlyph } from "./glyphs.tsx";
import type { Translate } from "./locale.ts";
import { HeaderButton, LeadingGap, type PaneInfoHooks, usePaneInfo } from "./PaneFrame.tsx";

export interface SwitcherProps extends PaneInfoHooks {
	readonly order: readonly PaneId[];
	readonly focus: PaneId;
	readonly sessionOf: ReadonlyMap<PaneId, SessionId | undefined>;
	readonly creating: ReadonlySet<PaneId>;
	readonly onPick: (id: PaneId) => void;
	/** Shown while a pane is maximized, to restore the split. */
	readonly onRestore: (() => void) | undefined;
	/** Shown when evening out the shares would let every pane fit again. */
	readonly onEven: (() => void) | undefined;
	/** Start padding that keeps the pills clear of the macOS window controls. */
	readonly leadingInset: number;
	readonly t: Translate;
}

export function Switcher(props: SwitcherProps): ReactNode {
	return (
		<div
			className="dsp-switcher"
			data-window-drag=""
			style={props.leadingInset > 0 ? { paddingLeft: props.leadingInset } : undefined}
		>
			<LeadingGap width={props.leadingInset} />
			<div className="dsp-switcher-tabs" role="tablist" aria-label={props.t("switcher.label")}>
				{props.order.map((id) => (
					<SwitcherTab key={id} {...props} id={id} sessionId={props.sessionOf.get(id)} />
				))}
			</div>
			{props.onEven === undefined ? null : (
				<Button size="sm" variant="secondary" className="dsp-switcher-even" onClick={props.onEven}>
					{props.t("switcher.even")}
				</Button>
			)}
			{props.onRestore === undefined ? null : (
				<HeaderButton
					label={props.t("pane.restore")}
					icon={<RestoreGlyph />}
					onClick={props.onRestore}
				/>
			)}
		</div>
	);
}

function SwitcherTab(
	props: SwitcherProps & { readonly id: PaneId; readonly sessionId: SessionId | undefined },
): ReactNode {
	const { title, status } = usePaneInfo(
		props,
		props.sessionId,
		props.creating.has(props.id),
		props.t,
	);
	const selected = props.id === props.focus;
	const ref = useRef<HTMLButtonElement>(null);
	// With many panes the strip scrolls; keep the chosen pill in view.
	useLayoutEffect(() => {
		const tab = ref.current;
		const strip = tab?.parentElement ?? null;
		if (!selected || tab === null || strip === null) return;
		const tabBox = tab.getBoundingClientRect();
		const stripBox = strip.getBoundingClientRect();
		if (tabBox.left < stripBox.left) strip.scrollLeft -= stripBox.left - tabBox.left;
		else if (tabBox.right > stripBox.right) strip.scrollLeft += tabBox.right - stripBox.right;
	}, [selected]);
	return (
		<button
			ref={ref}
			type="button"
			role="tab"
			aria-selected={selected}
			className="dsp-switcher-tab"
			title={title}
			onClick={() => props.onPick(props.id)}
		>
			{status === undefined ? null : <StatusDot status={status} />}
			<span className="dsp-switcher-label">{title}</span>
		</button>
	);
}
