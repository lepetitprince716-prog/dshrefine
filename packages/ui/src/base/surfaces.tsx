import { type CSSProperties, forwardRef, type ReactNode, useId, useState } from "react";
import { ChevronRightGlyph, CloseGlyph } from "./glyphs.tsx";
import { Button, IconButton } from "./primitives.tsx";
import { cx } from "./util.ts";

export interface DisclosureProps {
	readonly title: ReactNode;
	/** Controlled state; leave undefined to let the component own it. */
	readonly open?: boolean;
	readonly defaultOpen?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
	/** Shown after the title, for example the size of a collapsed section. */
	readonly count?: ReactNode;
	/** Controls placed at the end of the header row, outside the toggle button. */
	readonly actions?: ReactNode;
	readonly children: ReactNode;
	readonly className?: string;
}

/** Collapsible section: a header button with `aria-expanded` controlling a panel. */
export function Disclosure({
	title,
	open,
	defaultOpen = false,
	onOpenChange,
	count,
	actions,
	children,
	className,
}: DisclosureProps) {
	const auto = useId();
	const panelId = `rf-disclosure-${auto}`;
	const [own, setOwn] = useState(defaultOpen);
	const isOpen = open ?? own;
	const toggle = (): void => {
		if (open === undefined) setOwn(!isOpen);
		onOpenChange?.(!isOpen);
	};
	return (
		<div className={cx("rf-disclosure", className)} data-open={isOpen || undefined}>
			<div className="rf-disclosure-header">
				<button
					type="button"
					className="rf-disclosure-trigger"
					aria-expanded={isOpen}
					aria-controls={panelId}
					onClick={toggle}
				>
					<span className="rf-disclosure-chevron" aria-hidden="true">
						<ChevronRightGlyph />
					</span>
					<span className="rf-disclosure-title">{title}</span>
					{/* The space keeps title and count apart in the accessible name; flex layout hides it. */}
					{count === undefined || count === null ? null : (
						<>
							{" "}
							<span className="rf-disclosure-count">{count}</span>
						</>
					)}
				</button>
				{actions === undefined ? null : <div className="rf-disclosure-actions">{actions}</div>}
			</div>
			<div id={panelId} className="rf-disclosure-panel" hidden={!isOpen}>
				{children}
			</div>
		</div>
	);
}

export interface EmptyStateProps {
	readonly icon?: ReactNode;
	readonly title: ReactNode;
	readonly description?: ReactNode;
	/** Primary next step, for example a button or an input. */
	readonly action?: ReactNode;
	readonly className?: string;
}

/** Centred glyph over title and explanation in tertiary text. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
	return (
		<div className={cx("rf-empty", className)}>
			{icon === undefined ? null : (
				<div className="rf-empty-glyph" aria-hidden="true">
					{icon}
				</div>
			)}
			<p className="rf-empty-title">{title}</p>
			{description === undefined || description === null ? null : (
				<p className="rf-empty-description">{description}</p>
			)}
			{action === undefined ? null : <div className="rf-empty-action">{action}</div>}
		</div>
	);
}

/** Shape of the `error` of a failed kit request (`{ ok: false, error }`). */
export interface UiErrorLike {
	readonly code: string;
	readonly message: string;
}

export interface ErrorBannerProps {
	readonly error: UiErrorLike;
	/** Optional heading above the server message. */
	readonly title?: ReactNode;
	readonly onRetry?: () => void;
	/** Label of the retry button; the button needs both `onRetry` and this. */
	readonly retryLabel?: string;
	/** Shows the retry button in its loading state. */
	readonly retrying?: boolean;
	readonly onDismiss?: () => void;
	readonly dismissLabel?: string;
	readonly className?: string;
}

/** Inline `role="alert"` banner for a failed request, with the error code and a retry button. */
export function ErrorBanner({
	error,
	title,
	onRetry,
	retryLabel,
	retrying = false,
	onDismiss,
	dismissLabel,
	className,
}: ErrorBannerProps) {
	return (
		<div role="alert" className={cx("rf-error-banner", className)}>
			<span className="rf-error-banner-mark" aria-hidden="true" />
			<div className="rf-error-banner-text">
				{title === undefined || title === null ? null : (
					<p className="rf-error-banner-title">{title}</p>
				)}
				<p className="rf-error-banner-message">{error.message}</p>
				<code className="rf-error-banner-code">{error.code}</code>
			</div>
			{onRetry === undefined || retryLabel === undefined ? null : (
				<Button size="sm" variant="secondary" loading={retrying} onClick={onRetry}>
					{retryLabel}
				</Button>
			)}
			{onDismiss === undefined || dismissLabel === undefined ? null : (
				<IconButton size="sm" icon={<CloseGlyph />} label={dismissLabel} onClick={onDismiss} />
			)}
		</div>
	);
}

export interface SkeletonProps {
	readonly width?: number | string;
	readonly height?: number | string;
	/** Renders a paragraph of bars; the last bar is shorter. */
	readonly lines?: number;
	readonly radius?: "xs" | "sm" | "md";
	readonly className?: string;
}

/** Decorative loading placeholder; it shimmers unless reduced motion is requested. */
export function Skeleton({ width, height, lines = 1, radius = "xs", className }: SkeletonProps) {
	const bar = (key: number, last: boolean) => (
		<span
			key={key}
			className={cx(
				"rf-skeleton",
				`rf-skeleton-${radius}`,
				lines > 1 && last && "rf-skeleton-last",
			)}
			style={{
				...(width === undefined ? {} : { width }),
				...(height === undefined ? {} : { height }),
			}}
		/>
	);
	if (lines <= 1) {
		return (
			<span className={cx("rf-skeleton-group", className)} aria-hidden="true">
				{bar(0, true)}
			</span>
		);
	}
	return (
		<span className={cx("rf-skeleton-group", "rf-skeleton-lines", className)} aria-hidden="true">
			{Array.from({ length: lines }, (_, index) => bar(index, index === lines - 1))}
		</span>
	);
}

export interface ScrollAreaProps {
	readonly children: ReactNode;
	readonly orientation?: "vertical" | "horizontal" | "both";
	readonly maxHeight?: number | string;
	/** Names the region and makes it keyboard-focusable so it can be scrolled with keys. */
	readonly label?: string;
	readonly className?: string;
	readonly style?: CSSProperties;
}

/** Scroll container with quiet scrollbars that show on hover and focus. */
export const ScrollArea = forwardRef<HTMLElement, ScrollAreaProps>(function ScrollArea(
	{ children, orientation = "vertical", maxHeight, label, className, style },
	ref,
) {
	const merged: CSSProperties = { ...style, ...(maxHeight === undefined ? {} : { maxHeight }) };
	return (
		<section
			ref={ref}
			className={cx("rf-scroll", className)}
			data-orientation={orientation}
			style={merged}
			aria-label={label}
			tabIndex={label === undefined ? undefined : 0}
		>
			{children}
		</section>
	);
});
