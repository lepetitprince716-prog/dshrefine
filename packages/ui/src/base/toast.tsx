import { type FocusEvent, type MouseEvent, useEffect, useRef } from "react";
import { CloseGlyph } from "./glyphs.tsx";
import type { OverlayStore, ToastAction, ToastEntry, ToastTone } from "./overlay.ts";
import { cx } from "./util.ts";

/** Default auto-dismiss delay of a toast, in ms. */
export const TOAST_DURATION_MS = 5000;

export interface ToastProps {
	readonly text: string;
	readonly tone?: ToastTone;
	readonly action?: ToastAction;
	/** Called by the action and the dismiss button. */
	readonly onClose?: () => void;
	/** Accessible name of the dismiss button; the button is omitted without it. */
	readonly closeLabel?: string;
	readonly className?: string;
	readonly onMouseEnter?: (event: MouseEvent<HTMLDivElement>) => void;
	readonly onMouseLeave?: (event: MouseEvent<HTMLDivElement>) => void;
	readonly onFocus?: (event: FocusEvent<HTMLDivElement>) => void;
	readonly onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
}

/**
 * One toast. `warn` and `error` announce assertively (`role="alert"`), the rest politely. Shown
 * by `OverlayLayer` for `store.toast(...)`; render it directly only for previews.
 */
export function Toast({
	text,
	tone = "info",
	action,
	onClose,
	closeLabel,
	className,
	...handlers
}: ToastProps) {
	const assertive = tone === "warn" || tone === "error";
	return (
		<div
			{...handlers}
			role={assertive ? "alert" : "status"}
			className={cx("rf-toast", className)}
			data-tone={tone}
		>
			<span className="rf-toast-mark" aria-hidden="true" />
			<span className="rf-toast-text">{text}</span>
			{action === undefined ? null : (
				<button
					type="button"
					className="rf-toast-action"
					onClick={() => {
						action.run();
						onClose?.();
					}}
				>
					{action.label}
				</button>
			)}
			{onClose === undefined || closeLabel === undefined ? null : (
				<button type="button" className="rf-toast-close" aria-label={closeLabel} onClick={onClose}>
					<CloseGlyph size={14} />
				</button>
			)}
		</div>
	);
}

interface TimedToastProps {
	readonly entry: ToastEntry;
	readonly store: OverlayStore;
	readonly fallbackCloseLabel: string | undefined;
}

/** A toast that dismisses itself after `durationMs` and pauses while hovered or focused. */
export function TimedToast({ entry, store, fallbackCloseLabel }: TimedToastProps) {
	const duration = entry.durationMs ?? TOAST_DURATION_MS;
	const remaining = useRef(duration);
	const startedAt = useRef(0);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const hold = useRef({ hover: false, focus: false });

	const resume = (): void => {
		if (duration <= 0 || timer.current !== undefined) return;
		if (hold.current.hover || hold.current.focus) return;
		startedAt.current = Date.now();
		timer.current = setTimeout(() => store.close(entry.id), Math.max(0, remaining.current));
	};
	const pause = (): void => {
		if (timer.current === undefined) return;
		clearTimeout(timer.current);
		timer.current = undefined;
		remaining.current -= Date.now() - startedAt.current;
	};
	const resumeRef = useRef(resume);
	resumeRef.current = resume;

	useEffect(() => {
		resumeRef.current();
		return () => {
			if (timer.current !== undefined) clearTimeout(timer.current);
			timer.current = undefined;
		};
	}, []);

	const closeLabel = entry.closeLabel ?? fallbackCloseLabel;
	return (
		<Toast
			text={entry.text}
			{...(entry.tone === undefined ? {} : { tone: entry.tone })}
			{...(entry.action === undefined ? {} : { action: entry.action })}
			{...(closeLabel === undefined ? {} : { closeLabel })}
			onClose={() => store.close(entry.id)}
			onMouseEnter={() => {
				hold.current.hover = true;
				pause();
			}}
			onMouseLeave={() => {
				hold.current.hover = false;
				resume();
			}}
			onFocus={() => {
				hold.current.focus = true;
				pause();
			}}
			onBlur={(event) => {
				if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
				hold.current.focus = false;
				resume();
			}}
		/>
	);
}
