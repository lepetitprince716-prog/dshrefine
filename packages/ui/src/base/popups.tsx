import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { CloseGlyph } from "./glyphs.tsx";
import type { OverlayPlacement } from "./overlay.ts";
import { useOverlayLayer } from "./overlay-layer.tsx";
import { IconButton, Kbd } from "./primitives.tsx";
import { cx, focusableWithin } from "./util.ts";

export interface ModalProps {
	readonly open: boolean;
	/** Called when the user dismisses the dialog (Escape, mask, close button). */
	readonly onClose: () => void;
	readonly title: ReactNode;
	/** Accessible name of the close button. */
	readonly closeLabel: string;
	readonly description?: ReactNode;
	readonly footer?: ReactNode;
	readonly children?: ReactNode;
	/** Escape, mask and close button close the dialog; default true. */
	readonly dismissible?: boolean;
	/** A mask click closes a dismissible dialog; default true. */
	readonly closeOnMask?: boolean;
	readonly size?: "sm" | "md" | "lg";
	readonly className?: string;
}

/**
 * Dialog drawn by `OverlayLayer`: `role="dialog"`, `aria-modal`, labelled by its title, focus
 * trapped while topmost and returned to the opener on close. Put `data-autofocus` on the element
 * that should receive initial focus; otherwise the first focusable element after the close
 * button does.
 */
export function Modal({
	open,
	onClose,
	title,
	closeLabel,
	description,
	footer,
	children,
	dismissible = true,
	closeOnMask = true,
	size = "md",
	className,
}: ModalProps) {
	const auto = useId();
	const titleId = `rf-modal-${auto}-title`;
	const descriptionId = `rf-modal-${auto}-description`;
	const hasDescription = description !== undefined && description !== null;
	useOverlayLayer(open, {
		kind: "modal",
		labelledBy: titleId,
		...(hasDescription ? { describedBy: descriptionId } : {}),
		dismissible,
		closeOnMask,
		onClose,
		render: (close) => (
			<div className={cx("rf-modal", `rf-modal-${size}`, className)}>
				<div className="rf-modal-header">
					<h2 className="rf-modal-title" id={titleId}>
						{title}
					</h2>
					{dismissible ? (
						<IconButton
							data-rf-close=""
							className="rf-modal-close"
							size="sm"
							icon={<CloseGlyph />}
							label={closeLabel}
							onClick={close}
						/>
					) : null}
				</div>
				{hasDescription ? (
					<p className="rf-modal-description" id={descriptionId}>
						{description}
					</p>
				) : null}
				{children === undefined || children === null ? null : (
					<div className="rf-modal-body">{children}</div>
				)}
				{footer === undefined || footer === null ? null : (
					<div className="rf-modal-footer">{footer}</div>
				)}
			</div>
		),
	});
	return null;
}

export interface PopoverProps {
	readonly open: boolean;
	readonly onClose: () => void;
	/** Element the popover is positioned against; clicks on it do not count as outside. */
	readonly anchorRef: RefObject<HTMLElement | null>;
	readonly children: ReactNode;
	/** Accessible name of the popover surface. */
	readonly label?: string;
	readonly placement?: OverlayPlacement;
	readonly dismissible?: boolean;
	readonly matchAnchorWidth?: boolean;
	/** Move focus into the popover when it opens; default true. */
	readonly autoFocus?: boolean;
	readonly className?: string;
}

function PopoverSurface({
	label,
	autoFocus,
	className,
	children,
}: Pick<PopoverProps, "label" | "autoFocus" | "className" | "children">) {
	const surface = useRef<HTMLDivElement | null>(null);
	useLayoutEffect(() => {
		const node = surface.current;
		if (!autoFocus || node === null) return;
		(
			node.querySelector<HTMLElement>("[data-autofocus]") ??
			focusableWithin(node)[0] ??
			node
		).focus();
	}, [autoFocus]);
	return (
		<div
			ref={surface}
			role="dialog"
			aria-label={label}
			tabIndex={-1}
			className={cx("rf-popover", className)}
		>
			{children}
		</div>
	);
}

/** Anchored non-modal surface; Escape and outside pointer down close it when dismissible. */
export function Popover({
	open,
	onClose,
	anchorRef,
	children,
	label,
	placement = "bottom-start",
	dismissible = true,
	matchAnchorWidth = false,
	autoFocus = true,
	className,
}: PopoverProps) {
	useOverlayLayer(open, {
		kind: "anchored",
		anchor: () => anchorRef.current,
		placement,
		dismissible,
		matchAnchorWidth,
		onClose,
		render: () => (
			<PopoverSurface
				{...(label === undefined ? {} : { label })}
				{...(className === undefined ? {} : { className })}
				autoFocus={autoFocus}
			>
				{children}
			</PopoverSurface>
		),
	});
	return null;
}

export interface MenuItem {
	readonly kind?: "item";
	readonly id: string;
	readonly label: string;
	readonly onSelect: () => void;
	readonly icon?: ReactNode;
	readonly shortcut?: string;
	readonly danger?: boolean;
	readonly disabled?: boolean;
}

export interface MenuSeparator {
	readonly kind: "separator";
	readonly id: string;
}

export type MenuEntry = MenuItem | MenuSeparator;

export interface MenuProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly anchorRef: RefObject<HTMLElement | null>;
	readonly items: readonly MenuEntry[];
	/** Accessible name of the menu. */
	readonly label: string;
	readonly placement?: OverlayPlacement;
	readonly className?: string;
}

const isItem = (entry: MenuEntry): entry is MenuItem => entry.kind !== "separator";

function MenuSurface({
	items,
	label,
	className,
	onDone,
}: {
	readonly items: readonly MenuEntry[];
	readonly label: string;
	readonly className: string | undefined;
	readonly onDone: () => void;
}) {
	const surface = useRef<HTMLDivElement | null>(null);
	const enabled = (): HTMLElement[] =>
		surface.current === null
			? []
			: [
					...surface.current.querySelectorAll<HTMLElement>(
						'[role="menuitem"]:not([aria-disabled="true"])',
					),
				];

	useLayoutEffect(() => {
		const node = surface.current;
		const first = node?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
		(first ?? node)?.focus();
	}, []);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		const list = enabled();
		if (list.length === 0) return;
		const current = list.indexOf(document.activeElement as HTMLElement);
		let next: HTMLElement | undefined;
		if (event.key === "ArrowDown") next = list[(current + 1) % list.length];
		else if (event.key === "ArrowUp") next = list[(current - 1 + list.length) % list.length];
		else if (event.key === "Home") next = list[0];
		else if (event.key === "End") next = list.at(-1);
		else if (event.key === "Tab") {
			event.preventDefault();
			onDone();
			return;
		} else if (event.key.length === 1 && event.key !== " ") {
			const char = event.key.toLowerCase();
			for (let step = 1; step <= list.length; step++) {
				const candidate = list[(current + step) % list.length];
				if (candidate?.textContent?.trim().toLowerCase().startsWith(char)) {
					next = candidate;
					break;
				}
			}
		}
		if (next === undefined) return;
		event.preventDefault();
		next.focus();
	};

	return (
		<div
			ref={surface}
			role="menu"
			aria-label={label}
			tabIndex={-1}
			className={cx("rf-menu", className)}
			onKeyDown={onKeyDown}
		>
			{items.map((entry) =>
				isItem(entry) ? (
					<button
						key={entry.id}
						type="button"
						role="menuitem"
						tabIndex={-1}
						className="rf-menu-item"
						data-danger={entry.danger || undefined}
						aria-disabled={entry.disabled || undefined}
						onClick={() => {
							if (entry.disabled) return;
							onDone();
							entry.onSelect();
						}}
					>
						{entry.icon === undefined ? null : (
							<span className="rf-menu-glyph" aria-hidden="true">
								{entry.icon}
							</span>
						)}
						<span className="rf-menu-label">{entry.label}</span>
						{entry.shortcut === undefined ? null : (
							<Kbd className="rf-menu-shortcut">{entry.shortcut}</Kbd>
						)}
					</button>
				) : (
					<hr key={entry.id} className="rf-menu-separator" />
				),
			)}
		</div>
	);
}

/**
 * `role="menu"` anchored to `anchorRef`. Focus moves to the first enabled item; arrows, Home and
 * End move it, a printed character jumps to the next item starting with it, Escape and Tab close
 * the menu, and focus returns to the anchor. Selecting an item closes the menu first, then calls
 * `onSelect`.
 */
export function Menu({
	open,
	onClose,
	anchorRef,
	items,
	label,
	placement = "bottom-start",
	className,
}: MenuProps) {
	useOverlayLayer(open, {
		kind: "anchored",
		anchor: () => anchorRef.current,
		placement,
		onClose,
		render: (close) => (
			<MenuSurface items={items} label={label} className={className} onDone={close} />
		),
	});
	return null;
}

/** Hover or focus delay before a tooltip appears, in ms. */
export const TOOLTIP_DELAY_MS = 400;

export interface TooltipProps {
	readonly label: string;
	/** The trigger; its first element child gets `aria-describedby` while the tooltip shows. */
	readonly children: ReactNode;
	readonly placement?: OverlayPlacement;
	readonly delayMs?: number;
	readonly disabled?: boolean;
	readonly className?: string;
}

/** Shows `label` after a delay on hover and on keyboard focus; Escape hides it. */
export function Tooltip({
	label,
	children,
	placement = "top-start",
	delayMs = TOOLTIP_DELAY_MS,
	disabled = false,
	className,
}: TooltipProps) {
	const auto = useId();
	const tooltipId = `rf-tooltip-${auto}`;
	const wrapper = useRef<HTMLSpanElement | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [open, setOpen] = useState(false);

	const cancel = (): void => {
		if (timer.current !== undefined) clearTimeout(timer.current);
		timer.current = undefined;
	};
	const schedule = (): void => {
		if (disabled) return;
		cancel();
		timer.current = setTimeout(() => {
			timer.current = undefined;
			setOpen(true);
		}, delayMs);
	};
	const hide = (): void => {
		cancel();
		setOpen(false);
	};

	useEffect(
		() => () => {
			if (timer.current !== undefined) clearTimeout(timer.current);
		},
		[],
	);
	useEffect(() => {
		if (!disabled) return;
		if (timer.current !== undefined) clearTimeout(timer.current);
		timer.current = undefined;
		setOpen(false);
	}, [disabled]);
	useEffect(() => {
		const target = wrapper.current?.firstElementChild;
		if (!open || target === null || target === undefined) return;
		const previous = target.getAttribute("aria-describedby");
		target.setAttribute(
			"aria-describedby",
			previous === null ? tooltipId : `${previous} ${tooltipId}`,
		);
		return () => {
			if (previous === null) target.removeAttribute("aria-describedby");
			else target.setAttribute("aria-describedby", previous);
		};
	}, [open, tooltipId]);

	useOverlayLayer(open, {
		kind: "anchored",
		anchor: () => wrapper.current,
		placement,
		onClose: hide,
		render: () => (
			<div id={tooltipId} role="tooltip" className={cx("rf-tooltip", className)}>
				{label}
			</div>
		),
	});

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only observes hover and focus of the trigger it wraps
		<span
			ref={wrapper}
			className="rf-tooltip-anchor"
			onMouseEnter={schedule}
			onMouseLeave={hide}
			onFocus={schedule}
			onBlur={hide}
			onPointerDown={hide}
		>
			{children}
		</span>
	);
}
