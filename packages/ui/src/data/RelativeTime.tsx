import { useEffect, useState } from "react";

export interface RelativeTimeProps {
	/** The moment to describe: epoch milliseconds, a Date, or an ISO string. */
	readonly at: number | Date | string;
	/** Fixed "now" in epoch milliseconds; when given the component does not tick. */
	readonly now?: number;
	/** Localized label for `now - at` (positive in the past, negative in the future). */
	readonly format: (deltaMs: number) => string;
	/** Absolute value shown in `title`; defaults to the runtime's locale string. */
	readonly formatAbsolute?: (at: Date) => string;
	readonly className?: string;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Tick fast while the label changes every second, slower as the distance grows. */
export function nextTickDelay(deltaMs: number): number {
	const distance = Math.abs(deltaMs);
	if (distance < MINUTE) return SECOND;
	if (distance < HOUR) return 15 * SECOND;
	return MINUTE;
}

export function RelativeTime({ at, now, format, formatAbsolute, className }: RelativeTimeProps) {
	const time = typeof at === "number" ? at : new Date(at).getTime();
	const [clock, setClock] = useState(() => Date.now());

	useEffect(() => {
		if (now !== undefined || Number.isNaN(time)) return;
		// Re-armed after every tick: the delay depends on how far the last tick was from `at`.
		const timer = setTimeout(() => setClock(Date.now()), nextTickDelay(clock - time));
		return () => clearTimeout(timer);
	}, [now, time, clock]);

	if (Number.isNaN(time)) return null;
	const date = new Date(time);
	const current = now ?? clock;
	return (
		<time
			className={className === undefined ? "rf-time" : `rf-time ${className}`}
			dateTime={date.toISOString()}
			title={formatAbsolute === undefined ? date.toLocaleString() : formatAbsolute(date)}
		>
			{format(current - time)}
		</time>
	);
}
