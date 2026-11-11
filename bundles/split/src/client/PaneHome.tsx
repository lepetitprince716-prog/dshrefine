// The home surface of an empty pane: choose where the conversation lives and which mode it runs,
// then start it. Keeping the choice here is what separates a pane from the host's main surface —
// the host resolves a new Session from the sidebar's current selection, which would silently put
// the conversation in whatever project the main view happens to show.
import { Button, Icon, TextInput } from "@refine/ui";
import { type CSSProperties, type FormEvent, type ReactNode, useMemo, useState } from "react";
import type { WorkspaceView } from "../dsh-types.d.ts";
import type { Translate } from "./locale.ts";

/** One selectable agent mode, as the host roster reports it. */
export interface PanePreset {
	readonly id: string;
	readonly name?: string;
	readonly description?: string;
}

export interface PaneHomeProps {
	readonly workspaces: readonly WorkspaceView[];
	readonly workspacesReady: boolean;
	/** Workspace of the pane the new conversation is placed beside. */
	readonly defaultWorkspaceId: string | undefined;
	readonly presets: readonly PanePreset[];
	readonly defaultPreset: string | undefined;
	readonly onStart: (input: {
		readonly workspaceId?: string;
		readonly path?: string;
		readonly agentPreset?: string;
	}) => Promise<void>;
	readonly onOpenExisting: () => void;
	readonly t: Translate;
}

const ROW_STYLE: CSSProperties = {};

export function PaneHome(props: PaneHomeProps): ReactNode {
	const { workspaces, workspacesReady, defaultWorkspaceId, presets, defaultPreset, onStart, t } =
		props;
	const [workspaceId, setWorkspaceId] = useState<string | undefined>(defaultWorkspaceId);
	const [path, setPath] = useState("");
	const [preset, setPreset] = useState<string | undefined>(defaultPreset);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const selected = useMemo(
		() => workspaces.find((item) => item.workspaceId === workspaceId),
		[workspaces, workspaceId],
	);
	const chosenPreset = preset ?? defaultPreset;

	const start = (event?: FormEvent): void => {
		event?.preventDefault();
		if (busy) return;
		const trimmed = path.trim();
		if (workspaceId === undefined && trimmed === "") {
			setError(t("home.needProject"));
			return;
		}
		setBusy(true);
		setError(null);
		onStart({
			...(workspaceId === undefined ? {} : { workspaceId }),
			...(workspaceId === undefined ? { path: trimmed } : {}),
			...(chosenPreset === undefined ? {} : { agentPreset: chosenPreset }),
		}).catch((cause: unknown) => {
			setError(t("picker.createFailed", { message: String((cause as Error)?.message ?? cause) }));
			setBusy(false);
		});
	};

	return (
		<form className="dsp-home" onSubmit={start}>
			<div className="dsp-home-head">
				<span className="dsp-home-title">{t("home.title")}</span>
				<span className="dsp-home-hint">{t("home.hint")}</span>
			</div>

			<section className="dsp-home-section">
				<span className="dsp-home-label">{t("home.project")}</span>
				<div className="dsp-home-projects" role="radiogroup" aria-label={t("home.project")}>
					{workspacesReady && workspaces.length === 0 ? (
						<p className="dsp-home-empty">{t("home.noProjects")}</p>
					) : null}
					{workspaces.map((item) => {
						const active = item.workspaceId === workspaceId;
						return (
							<button
								key={item.workspaceId}
								type="button"
								role="radio"
								aria-checked={active}
								className="dsp-home-project"
								style={ROW_STYLE}
								onClick={() => {
									setWorkspaceId(item.workspaceId);
									setPath("");
									setError(null);
								}}
							>
								<Icon name="folder" size={15} />
								<span className="dsp-home-project-name">{item.title}</span>
								<span className="dsp-home-project-path">{item.path}</span>
								{active ? <Icon name="check" size={14} /> : null}
							</button>
						);
					})}
				</div>
				<div className="dsp-home-path">
					<TextInput
						value={path}
						onChange={(event) => setPath(event.currentTarget.value)}
						placeholder={t("home.pathPlaceholder")}
						aria-label={t("home.pathPlaceholder")}
						onFocus={() => setWorkspaceId(undefined)}
						onKeyDown={(event) => {
							if (event.key !== "Enter") return;
							event.preventDefault();
							if (path.trim() !== "") setWorkspaceId(undefined);
							setError(null);
						}}
					/>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => {
							if (path.trim() !== "") setWorkspaceId(undefined);
							setError(null);
						}}
					>
						{t("home.usePath")}
					</Button>
				</div>
				{selected === undefined ? null : (
					<span className="dsp-home-selected">{t("home.selected", { path: selected.path })}</span>
				)}
			</section>

			{presets.length === 0 ? null : (
				<section className="dsp-home-section">
					<span className="dsp-home-label">{t("home.mode")}</span>
					<div className="dsp-home-modes" role="radiogroup" aria-label={t("home.mode")}>
						{presets.map((item) => {
							const active = item.id === chosenPreset;
							return (
								<button
									key={item.id}
									type="button"
									role="radio"
									aria-checked={active}
									className="dsp-home-mode"
									title={item.description}
									onClick={() => setPreset(item.id)}
								>
									{item.name ?? item.id}
								</button>
							);
						})}
					</div>
				</section>
			)}

			{error === null ? null : (
				<div className="dsp-home-error" role="alert">
					{error}
				</div>
			)}

			<div className="dsp-home-actions">
				<Button size="md" variant="primary" type="submit" loading={busy}>
					{busy ? t("home.starting") : t("home.start")}
				</Button>
				<Button size="md" variant="ghost" type="button" onClick={props.onOpenExisting}>
					{t("home.existing")}
				</Button>
			</div>
		</form>
	);
}
