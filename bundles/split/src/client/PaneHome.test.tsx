// The home surface owns the choice of a new conversation's project and mode: these tests pin
// that a folder picked through the host chooser becomes the conversation's directory, that a
// listed Workspace travels as itself, and that a cancelled or failed chooser changes nothing.
import "@refine/ui/testing/register";
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { loadTestingLibrary, releaseDomAfterAll } from "@refine/ui/testing";
import type { Translate } from "./locale.ts";
import { PaneHome, type PaneHomeProps } from "./PaneHome.tsx";

const { cleanup, fireEvent, render, waitFor } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

/** The English keys this surface reads, resolved the way the host dictionary would. */
const messages: Record<string, string> = {
	"home.title": "New conversation",
	"home.hint": "Choose a project or folder and a mode, then start below.",
	"home.project": "Project",
	"home.noProjects": "No projects yet. Pick a folder, or type a path.",
	"home.pathPlaceholder": "Folder path",
	"home.browse": "Choose folder",
	"home.browsing": "Opening…",
	"home.pickFailed": "Could not open the folder chooser: {message}",
	"home.selected": "The conversation will live in {path}",
	"home.mode": "Mode",
	"home.start": "Start conversation",
	"home.starting": "Creating…",
	"home.existing": "Open an existing conversation",
	"home.needProject": "Choose a project or enter a folder path first.",
	"picker.createFailed": "Could not create a conversation: {message}",
};

const t = ((key: string, params: Record<string, string | number> = {}) =>
	(messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
		String(params[name] ?? ""),
	)) as unknown as Translate;

interface Started {
	readonly workspaceId?: string;
	readonly path?: string;
	readonly agentPreset?: string;
}

type View = ReturnType<typeof render>;

function formOf(view: View): HTMLFormElement {
	const form = view.container.querySelector("form");
	if (form === null) throw new Error("no form");
	return form;
}

function mount(overrides: Partial<PaneHomeProps> = {}): { started: Started[]; view: View } {
	const started: Started[] = [];
	const view = render(
		<PaneHome
			workspaces={[]}
			workspacesReady
			defaultWorkspaceId={undefined}
			presets={[]}
			defaultPreset={undefined}
			onStart={(input) => {
				started.push(input);
				return Promise.resolve();
			}}
			onPickFolder={async () => null}
			onOpenExisting={() => {}}
			t={t}
			{...overrides}
		/>,
	);
	return { started, view };
}

describe("PaneHome", () => {
	it("starts the conversation in the folder the host chooser returned", async () => {
		const { started, view } = mount({ onPickFolder: async () => "/work/picked" });
		fireEvent.click(view.getByRole("button", { name: "Choose folder" }));
		await waitFor(() => {
			expect((view.getByLabelText("Folder path") as HTMLInputElement).value).toBe("/work/picked");
		});
		expect(view.getByText("The conversation will live in /work/picked")).toBeDefined();
		fireEvent.submit(formOf(view));
		expect(started).toEqual([{ path: "/work/picked" }]);
	});

	it("leaves the choice alone when the chooser is cancelled", async () => {
		const cancelling = Promise.withResolvers<string | null>();
		const { started, view } = mount({ onPickFolder: () => cancelling.promise });
		fireEvent.click(view.getByRole("button", { name: "Choose folder" }));
		cancelling.resolve(null);
		await waitFor(() => {
			expect(view.getByRole("button", { name: "Choose folder" })).toBeDefined();
		});
		expect((view.getByLabelText("Folder path") as HTMLInputElement).value).toBe("");
		fireEvent.submit(formOf(view));
		expect(started).toEqual([]);
		expect(view.getByRole("alert").textContent).toContain(
			"Choose a project or enter a folder path first.",
		);
	});

	it("reports a chooser failure inline and keeps the typed path usable", async () => {
		const { view } = mount({
			onPickFolder: async () => {
				throw new Error("no display");
			},
		});
		fireEvent.click(view.getByRole("button", { name: "Choose folder" }));
		await waitFor(() => {
			expect(view.getByRole("alert").textContent).toContain("no display");
		});
		expect((view.getByLabelText("Folder path") as HTMLInputElement).value).toBe("");
	});

	it("starts in the listed Workspace that is selected", () => {
		const { started, view } = mount({
			workspaces: [{ workspaceId: "w1", path: "/work/alpha", title: "Alpha", sessionIds: [] }],
			defaultWorkspaceId: "w1",
		});
		fireEvent.submit(formOf(view));
		expect(started).toEqual([{ workspaceId: "w1" }]);
	});

	it("sends the chosen agent mode with the project", () => {
		const { started, view } = mount({
			workspaces: [{ workspaceId: "w1", path: "/work/alpha", title: "Alpha", sessionIds: [] }],
			defaultWorkspaceId: "w1",
			presets: [
				{ id: "standard", name: "Standard" },
				{ id: "minimal", name: "Minimal" },
			],
			defaultPreset: "standard",
		});
		fireEvent.click(view.getByRole("radio", { name: "Minimal" }));
		fireEvent.submit(formOf(view));
		expect(started).toEqual([{ workspaceId: "w1", agentPreset: "minimal" }]);
	});

	it("a typed path replaces a selected Workspace", () => {
		const { started, view } = mount({
			workspaces: [{ workspaceId: "w1", path: "/work/alpha", title: "Alpha", sessionIds: [] }],
			defaultWorkspaceId: "w1",
		});
		const input = view.getByLabelText("Folder path") as HTMLInputElement;
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "  ~/code/new  " } });
		fireEvent.submit(formOf(view));
		expect(started).toEqual([{ path: "~/code/new" }]);
	});

	it("keeps the surface usable when creating the conversation fails", async () => {
		const { view } = mount({
			workspaces: [{ workspaceId: "w1", path: "/work/alpha", title: "Alpha", sessionIds: [] }],
			defaultWorkspaceId: "w1",
			onStart: () => Promise.reject(new Error("offline")),
		});
		fireEvent.submit(formOf(view));
		await waitFor(() => {
			expect(view.getByRole("alert").textContent).toContain("offline");
		});
	});
});
