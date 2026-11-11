import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cx } from "./util.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
	/** One `primary` per view (DESIGN 1.3); default `secondary`. */
	readonly variant?: ButtonVariant;
	/** `sm` is 24px high, `md` 32px; default `md`. */
	readonly size?: ButtonSize;
	/** Leading glyph, rendered decoratively. */
	readonly icon?: ReactNode;
	/** Square button showing only `icon`; pass `aria-label` (or use `IconButton`). */
	readonly iconOnly?: boolean;
	/** Shows a spinner, sets `aria-busy` and ignores clicks while true. */
	readonly loading?: boolean;
	readonly type?: "button" | "submit" | "reset";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		variant = "secondary",
		size = "md",
		icon,
		iconOnly = false,
		loading = false,
		type = "button",
		className,
		children,
		onClick,
		...rest
	},
	ref,
) {
	const glyph = loading ? <Spinner size="sm" /> : icon;
	return (
		<button
			{...rest}
			ref={ref}
			type={type}
			className={cx(
				"rf-btn",
				`rf-btn-${variant}`,
				`rf-btn-${size}`,
				iconOnly && "rf-btn-icon",
				className,
			)}
			aria-busy={loading || undefined}
			onClick={loading ? undefined : onClick}
		>
			{glyph === undefined || glyph === null ? null : (
				<span className="rf-btn-glyph" aria-hidden="true">
					{glyph}
				</span>
			)}
			{iconOnly || children === undefined || children === null ? null : (
				<span className="rf-btn-label">{children}</span>
			)}
		</button>
	);
});

export interface IconButtonProps extends Omit<ButtonProps, "iconOnly" | "icon" | "children"> {
	readonly icon: ReactNode;
	/** Accessible name; icon-only buttons always need one (DESIGN 5). */
	readonly label: string;
}

/** Square icon-only button; default variant `ghost`. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
	{ icon, label, variant = "ghost", ...rest },
	ref,
) {
	return <Button {...rest} ref={ref} variant={variant} icon={icon} iconOnly aria-label={label} />;
});

export type ChipTone = "neutral" | "success" | "warn" | "error" | "info" | "business";

export interface ChipProps {
	readonly tone?: ChipTone;
	readonly icon?: ReactNode;
	readonly children: ReactNode;
	/** Code font for shas, branches and paths. */
	readonly mono?: boolean;
	readonly title?: string;
	/** Accessible name of a clickable chip whose text alone is ambiguous. */
	readonly "aria-label"?: string;
	/** Makes the chip a button (for example a commit chip that navigates). */
	readonly onClick?: () => void;
	readonly disabled?: boolean;
	readonly className?: string;
}

/** 18px status or metadata chip with radius 4. */
export function Chip({
	tone = "neutral",
	icon,
	children,
	mono = false,
	title,
	onClick,
	disabled = false,
	className,
	"aria-label": ariaLabel,
}: ChipProps) {
	const classes = cx("rf-chip", `rf-chip-${tone}`, mono && "rf-chip-mono", className);
	const content = (
		<>
			{icon === undefined ? null : (
				<span className="rf-chip-glyph" aria-hidden="true">
					{icon}
				</span>
			)}
			<span className="rf-chip-label">{children}</span>
		</>
	);
	if (onClick === undefined) {
		return (
			<span className={classes} title={title}>
				{content}
			</span>
		);
	}
	return (
		<button
			type="button"
			className={cx(classes, "rf-chip-button")}
			title={title}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={onClick}
		>
			{content}
		</button>
	);
}

export type StatusDotStatus = "idle" | "running" | "attention" | "done" | "error";

export interface StatusDotProps {
	readonly status: StatusDotStatus;
	/** Accessible text for the state; without it the dot is decorative. */
	readonly label?: string;
	readonly className?: string;
}

/** 8px state dot; `running` breathes at 1.2s unless reduced motion is requested. */
export function StatusDot({ status, label, className }: StatusDotProps) {
	return label === undefined ? (
		<span className={cx("rf-status-dot", className)} data-status={status} aria-hidden="true" />
	) : (
		<span
			className={cx("rf-status-dot", className)}
			data-status={status}
			role="img"
			aria-label={label}
		/>
	);
}

export function Kbd({
	children,
	className,
}: {
	readonly children: ReactNode;
	readonly className?: string;
}) {
	return <kbd className={cx("rf-kbd", className)}>{children}</kbd>;
}

export interface DividerProps {
	readonly orientation?: "horizontal" | "vertical";
	readonly className?: string;
}

/** Hairline that runs from container edge to container edge. */
export function Divider({ orientation = "horizontal", className }: DividerProps) {
	return (
		<hr
			aria-orientation={orientation}
			className={cx("rf-divider", className)}
			data-orientation={orientation}
		/>
	);
}

export interface SpinnerProps {
	/** Announced as a status when given; otherwise decorative. */
	readonly label?: string;
	readonly size?: "sm" | "md";
	readonly className?: string;
}

export function Spinner({ label, size = "md", className }: SpinnerProps) {
	const classes = cx("rf-spinner", `rf-spinner-${size}`, className);
	return label === undefined ? (
		<span className={classes} aria-hidden="true" />
	) : (
		<span className={classes} role="status" aria-label={label} />
	);
}
