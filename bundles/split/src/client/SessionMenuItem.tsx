// "Open in split view" in a Session row's "..." menu (`sidebar.workspaces.session.menu.item`).
// The shipped rows use ui-primitives' MenuItemButton, which this bundle must not require; the
// row is a plain `role="menuitem"` button whose look is copied from its neighbours at mount.
import { type ReactNode, useCallback } from "react";
import type { SessionId } from "../layout/tree.ts";
import type { Translate } from "./locale.ts";

export interface SessionMenuItemProps {
	readonly sessionId: SessionId;
	readonly useMenuOpenState: () => readonly [boolean, (open: boolean) => void];
	readonly openInSplit: (sessionId: SessionId) => void;
	readonly t: Translate;
}

/**
 * Copy the class lists of a shipped sibling row (button, icon box, label), so the row matches
 * the host menu exactly. Nothing depends on the class names themselves; without a sibling the
 * row keeps the bundle's own styling.
 */
function adoptSiblingClass(button: HTMLButtonElement | null): void {
	if (button === null) return;
	const sibling = [...(button.parentElement?.querySelectorAll('[role="menuitem"]') ?? [])].find(
		(element) => element !== button && !element.classList.contains("dsp-menu-item"),
	);
	if (sibling === undefined || sibling.className === "") return;
	button.className = sibling.className;
	const [icon, label] = sibling.children;
	const [ownIcon, ownLabel] = button.children;
	if (icon !== undefined && ownIcon !== undefined && icon.className !== "")
		ownIcon.className = icon.className;
	if (label !== undefined && ownLabel !== undefined && label.className !== "")
		ownLabel.className = label.className;
}

/** Same grid and stroke as the shipped menu icons (16px, 1px stroke). */
function MenuGlyph() {
	return (
		<svg
			width={16}
			height={16}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1}
			aria-hidden="true"
			focusable="false"
		>
			<rect x={1.5} y={2.5} width={13} height={11} rx={2} />
			<path d="M8 2.5v11" />
		</svg>
	);
}

export function SessionMenuItem({
	sessionId,
	useMenuOpenState,
	openInSplit,
	t,
}: SessionMenuItemProps): ReactNode {
	const [, setMenuOpen] = useMenuOpenState();
	const ref = useCallback(adoptSiblingClass, []);
	return (
		<button
			ref={ref}
			type="button"
			role="menuitem"
			className="dsp-menu-item"
			onClick={() => {
				setMenuOpen(false);
				openInSplit(sessionId);
			}}
		>
			<span className="dsp-menu-icon">
				<MenuGlyph />
			</span>
			<span className="dsp-menu-label">{t("menu.openInSplit")}</span>
		</button>
	);
}
