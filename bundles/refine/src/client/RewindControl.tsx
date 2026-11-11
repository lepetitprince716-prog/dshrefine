// Header controls for one conversation: open the rewind dialog, and move a running command to the
// background. Both act on the exact Session the header belongs to, so a split pane and the main
// view of the same conversation offer the same actions.
import { createOverlayStore, IconButton, OverlayProvider, Spinner, Tooltip } from "@refine/ui";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SessionId, SessionSlotProps } from "../dsh-types.d.ts";
import { readTimeline, rewind, type TimelineEntry } from "./api.ts";
import type { Translate } from "./locale.ts";

interface ControlProps {
	readonly sessionId: SessionId;
	readonly running: boolean;
	readonly openSession: (sessionId: SessionId) => void;
	readonly t: Translate;
}

function RewindGlyph(): ReactNode {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M2.6 6.4h6.1a3.1 3.1 0 0 1 0 6.2H6"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
			/>
			<path
				d="M5.1 3.4 2.4 6.4l2.7 3"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** Wall-clock time of a message; the day prefix appears only for older messages. */
function when(time: number): string {
	if (time === 0) return "";
	const date = new Date(time);
	const sameDay = new Date().toDateString() === date.toDateString();
	return sameDay
		? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: date.toLocaleDateString([], { month: "numeric", day: "numeric" });
}

/** Session-slot entry: the running flag comes from the standard session hook. */
export function HeaderRewind(
	props: Omit<SessionSlotProps, "t"> & { readonly openSession: (id: SessionId) => void; readonly t: Translate },
): ReactNode {
	const running = props.useSession((snapshot) => snapshot.running);
	return (
		<RewindControl
			sessionId={props.sessionId}
			running={running}
			openSession={props.openSession}
			t={props.t}
		/>
	);
}

/** Pane-header entry: the owning split passes the session id and running flag as owner props. */
export function PaneRewind(props: ControlProps): ReactNode {
	return <RewindControl {...props} />;
}

export function RewindControl(props: ControlProps): ReactNode {
	// The tooltips need an overlay provider of their own: the pane header renders outside the
	// split's provider, and the main conversation header has none either.
	const store = useMemo(() => createOverlayStore(), []);
	const running = props.running;
	const [open, setOpen] = useState(false);
	return (
		<OverlayProvider store={store}>
		<span className="rf-root rfx-ctl">
			<Tooltip label={props.t("header.rewind")} placement="bottom-end">
				<IconButton
					size="sm"
					label={props.t("header.rewind")}
					icon={<RewindGlyph />}
					onClick={() => setOpen(true)}
				/>
			</Tooltip>
			{open
				? createPortal(
						<RewindDialog
							sessionId={props.sessionId}
							running={running}
							onClose={() => setOpen(false)}
							onForked={(next) => {
								setOpen(false);
								props.openSession(next);
							}}
							t={props.t}
						/>,
						document.body,
					)
				: null}
		</span>
		</OverlayProvider>
	);
}

type Load =
	| { readonly phase: "loading" }
	| { readonly phase: "ready"; readonly messages: readonly TimelineEntry[] }
	| { readonly phase: "error"; readonly message: string };

function RewindDialog(props: {
	readonly sessionId: string;
	readonly running: boolean;
	readonly onClose: () => void;
	readonly onForked: (sessionId: string) => void;
	readonly t: Translate;
}): ReactNode {
	const [load, setLoad] = useState<Load>({ phase: "loading" });
	const [forking, setForking] = useState<number | undefined>(undefined);
	const [error, setError] = useState<string | null>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let alive = true;
		readTimeline(props.sessionId).then(
			(result) => {
				if (alive) setLoad({ phase: "ready", messages: result.messages });
			},
			(cause: unknown) => {
				if (alive)
					setLoad({
						phase: "error",
						message: String((cause as Error)?.message ?? cause),
					});
			},
		);
		return () => {
			alive = false;
		};
	}, [props.sessionId]);

	useEffect(() => {
		closeRef.current?.focus();
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				event.preventDefault();
				props.onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [props.onClose]);

	const pick = (entry: TimelineEntry): void => {
		if (forking !== undefined) return;
		setForking(entry.seq);
		setError(null);
		rewind(props.sessionId, entry.atSeq).then(
			(result) => props.onForked(result.sessionId),
			(cause: unknown) => {
				setForking(undefined);
				setError(String((cause as Error)?.message ?? cause));
			},
		);
	};

	const messages = useMemo(
		() => (load.phase === "ready" ? load.messages : []),
		[load],
	);

	return (
		<div
			className="rf-root rfx-mask"
			role="presentation"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) props.onClose();
			}}
		>
			<div
				ref={dialogRef}
				className="rfx-dialog"
				role="dialog"
				aria-modal="true"
				aria-label={props.t("rewind.title")}
			>
				<div className="rfx-head">
					<div className="rfx-head-text">
						<span className="rfx-title">{props.t("rewind.title")}</span>
						<span className="rfx-hint">{props.t("rewind.hint")}</span>
						{props.running ? (
							<span className="rfx-running">{props.t("rewind.running")}</span>
						) : null}
					</div>
					<button
						ref={closeRef}
						type="button"
						className="rfx-close"
						aria-label={props.t("rewind.close")}
						onClick={props.onClose}
					>
						×
					</button>
				</div>
				<div className="rfx-body">
					{load.phase === "loading" ? (
						<div className="rfx-state">{props.t("rewind.loading")}</div>
					) : null}
					{load.phase === "error" ? (
						<div className="rfx-state rfx-error">
							{props.t("rewind.failed", { message: load.message })}
						</div>
					) : null}
					{load.phase === "ready" && messages.length === 0 ? (
						<div className="rfx-state">{props.t("rewind.empty")}</div>
					) : null}
					{messages.map((entry) => (
						<button
							key={entry.seq}
							type="button"
							className="rfx-row"
							disabled={forking !== undefined}
							onClick={() => pick(entry)}
						>
							<span className="rfx-when">{when(entry.time)}</span>
							<span className="rfx-text">{entry.text}</span>
							{forking === entry.seq ? <Spinner size="sm" /> : null}
						</button>
					))}
				</div>
				{error === null ? null : (
					<div className="rfx-note rfx-error">{error}</div>
				)}
				<div className="rfx-note">{props.t("rewind.pick")}</div>
			</div>
		</div>
	);
}
