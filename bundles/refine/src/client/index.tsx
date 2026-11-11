// Browser module of @refine/refine: two controls in every conversation header. Rewind forks the
// conversation at the event before a chosen message; the background control releases a running
// `bash` call into its job. Both ask the Host, because neither is a client-only operation.
import type { ReactNode } from "react";
import type { ClientContext } from "../dsh-types.d.ts";
import { NS, registerLocale, type Translate } from "./locale.ts";
import { HeaderRewind, PaneRewind } from "./RewindControl.tsx";
import { PKG, REFINE_CSS } from "./styles.ts";

/** Header utilities sit after the shipped rows and before the split control at 900. */
const CONTROL_ORDER = 880;

export const inject = ["slots", "locale", "uiWorkspace"];

function injectStyle(file: string, css: string): () => void {
	const id = `${PKG}/${file}`;
	document.head.querySelector(`style[data-plugin-css="${CSS.escape(id)}"]`)?.remove();
	const element = document.createElement("style");
	element.dataset.plugin = PKG;
	element.dataset.pluginCss = id;
	element.textContent = css;
	document.head.append(element);
	return () => element.remove();
}

export function apply(ctx: ClientContext): void {
	ctx.effect(() => registerLocale(ctx), "refine: locale");
	ctx.effect(() => injectStyle("refine.css", REFINE_CSS), "refine: style");
	const t = ctx.locale.bind(NS) as Translate;

	ctx.effect(
		() =>
			ctx.slots.inject("conversation.session.header.utilities", () =>
				ctx.slots.register(
					{
						name: "conversation.session.header.utilities",
						id: "refine.rewind",
						order: CONTROL_ORDER,
						label: () => t("header.rewind"),
						locale: NS,
						inject: () => ({ openSession: (sessionId: string) => ctx.uiWorkspace.openSession(sessionId) }),
					},
					HeaderRewind as unknown as (props: never) => ReactNode,
				),
			),
		"refine: header controls",
	);

	// Split panes render their own headers; when the split bundle is loaded it publishes this slot
	// so the same two controls sit in every pane instead of only in the main view.
	ctx.effect(
		() =>
			ctx.slots.inject("dsh-split.pane.actions", () =>
				ctx.slots.register(
					{
						name: "dsh-split.pane.actions",
						id: "refine.rewind",
						order: CONTROL_ORDER,
						label: () => t("header.rewind"),
						locale: NS,
						inject: () => ({
							openSession: (sessionId: string) => ctx.uiWorkspace.openSession(sessionId),
						}),
					},
					PaneRewind as unknown as (props: never) => ReactNode,
				),
			),
		"refine: pane controls",
	);
}
