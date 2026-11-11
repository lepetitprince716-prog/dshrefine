// The body of a pane without a Session: pick an existing Session or create one in the same
// directory. A blank Session is created through `sessions.create`, never through the hero
// picker, which would navigate the main selection (lane-c-dsh-internals.md section 3).
import { Button, Icon, TextInput } from "@refine/ui";
import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from "react";
import type { SessionListState, SessionSummary } from "../dsh-types.d.ts";
import type { SessionId } from "../layout/tree.ts";
import type { Translate } from "./locale.ts";

/** Rows shown before the filter narrows the list. */
const MAX_ROWS = 50;

/** Sessions a pane may show: listed, not subagent children, not shown elsewhere; newest first. */
export function pickableSessions(
	list: SessionListState,
	shown: ReadonlySet<SessionId>,
	filter: string,
): readonly SessionSummary[] {
	const needle = filter.trim().toLowerCase();
	return list.ids
		.flatMap((id) => {
			const row = list.byId[id];
			return row === undefined || row.origin === "subagent" || row.blank || shown.has(id)
				? []
				: [row];
		})
		.filter(
			(row) =>
				needle === "" ||
				row.displayTitle.toLowerCase().includes(needle) ||
				(row.cwd ?? "").toLowerCase().includes(needle),
		)
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, MAX_ROWS);
}

function basename(path: string | undefined): string {
	if (path === undefined) return "";
	const parts = path.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] ?? path;
}

export interface PickerProps {
	/** Subscribed here rather than by the surface, so list updates re-render only open pickers. */
	readonly useSessions: <S>(selector: (state: SessionListState) => S) => S;
	readonly shown: ReadonlySet<SessionId>;
	readonly onPick: (sessionId: SessionId) => void;
	readonly onCreate: () => Promise<void>;
	readonly t: Translate;
}

/** Move focus between the filter and the rows with the arrow keys. */
function moveFocus(listElement: HTMLElement | null, from: Element | null, delta: number): boolean {
	const buttons = [...(listElement?.querySelectorAll<HTMLButtonElement>(".dsp-picker-row") ?? [])];
	if (buttons.length === 0) return false;
	const index = from instanceof HTMLButtonElement ? buttons.indexOf(from) : -1;
	const next = index + delta;
	if (next < 0 || next >= buttons.length) return false;
	buttons[next]?.focus();
	return true;
}

const wholeList = (state: SessionListState): SessionListState => state;

export function Picker({ useSessions, shown, onPick, onCreate, t }: PickerProps): ReactNode {
	const list = useSessions(wholeList);
	const [filter, setFilter] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const rows = useMemo(() => pickableSessions(list, shown, filter), [list, shown, filter]);
	const listRef = useRef<HTMLUListElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const onFilterKey = (event: KeyboardEvent<HTMLElement>): void => {
		if (event.key === "ArrowDown" && moveFocus(listRef.current, null, 1)) event.preventDefault();
		else if (event.key === "Enter" && filter.trim() !== "" && rows[0] !== undefined) {
			event.preventDefault();
			onPick(rows[0].id);
		}
	};
	const onRowKey = (event: KeyboardEvent<HTMLElement>): void => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		event.preventDefault();
		const delta = event.key === "ArrowDown" ? 1 : -1;
		if (!moveFocus(listRef.current, event.target as Element, delta) && delta < 0)
			inputRef.current?.focus();
	};

	const create = (): void => {
		setCreating(true);
		setError(null);
		onCreate()
			.catch((cause: unknown) => {
				setError(t("picker.createFailed", { message: String((cause as Error)?.message ?? cause) }));
			})
			.finally(() => setCreating(false));
	};

	return (
		<div className="dsp-picker">
			<div className="dsp-picker-intro">
				<span className="dsp-picker-heading">{t("picker.heading")}</span>
				<span className="dsp-picker-hint">{t("picker.hint")}</span>
			</div>
			<div className="dsp-picker-head">
				<TextInput
					ref={inputRef}
					value={filter}
					onChange={(event) => setFilter(event.currentTarget.value)}
					onKeyDown={onFilterKey}
					placeholder={t("picker.filter")}
					aria-label={t("picker.filter")}
				/>
				<Button
					size="md"
					variant="primary"
					icon={<Icon name="plus" size={14} />}
					loading={creating}
					onClick={create}
				>
					{creating ? t("picker.creating") : t("picker.new")}
				</Button>
			</div>
			{error === null ? null : (
				<div className="dsp-picker-error" role="alert">
					{error}
				</div>
			)}
			{rows.length === 0 ? (
				<div className="dsp-picker-empty">
					{filter.trim() === "" ? t("picker.empty") : t("picker.noMatch")}
				</div>
			) : (
				<ul className="dsp-picker-list" ref={listRef} onKeyDown={onRowKey}>
					{rows.map((row) => (
						<li key={row.id}>
							<button
								type="button"
								className="dsp-picker-row"
								onClick={() => onPick(row.id)}
								title={row.cwd === undefined ? row.displayTitle : `${row.displayTitle}\n${row.cwd}`}
							>
								<span className="dsp-picker-row-title">{row.displayTitle}</span>
								<span className="dsp-picker-row-path">{basename(row.cwd)}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
