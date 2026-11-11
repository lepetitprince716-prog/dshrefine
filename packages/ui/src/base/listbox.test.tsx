import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { type ReactNode, useState } from "react";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { Field } from "./field.tsx";
import { Combobox, matchOption, Select, type SelectItems } from "./listbox.tsx";
import { createOverlayStore } from "./overlay.ts";
import { OverlayLayer, OverlayProvider } from "./overlay-layer.tsx";

const { act, cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

function renderWithOverlay(ui: ReactNode) {
	const store = createOverlayStore();
	const view = render(
		<OverlayProvider store={store}>
			{ui}
			<OverlayLayer store={store} />
		</OverlayProvider>,
	);
	return { store, view };
}

const BRANCHES: SelectItems = [
	{
		label: "Local",
		options: [
			{ value: "main", label: "main" },
			{ value: "feature/login", label: "feature/login", description: "2 days ago" },
			{ value: "stale", label: "stale", disabled: true },
		],
	},
	{
		label: "Remote",
		options: [
			{ value: "origin/main", label: "origin/main" },
			{ value: "origin/release", label: "origin/release" },
		],
	},
];

function SelectHarness({ onChange }: { readonly onChange?: (value: string) => void }) {
	const [value, setValue] = useState<string | null>(null);
	return (
		<Select
			aria-label="Base branch"
			listLabel="Branches"
			placeholder="Choose a branch"
			value={value}
			options={BRANCHES}
			onChange={(next) => {
				onChange?.(next);
				setValue(next);
			}}
		/>
	);
}

describe("Select", () => {
	test("closed: a combobox button showing the placeholder", () => {
		const { view } = renderWithOverlay(<SelectHarness />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
		expect(trigger.textContent).toBe("Choose a branch");
		expect(view.queryByRole("listbox")).toBeNull();
	});

	test("click opens a grouped listbox controlled by the trigger", () => {
		const { view } = renderWithOverlay(<SelectHarness />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		fireEvent.click(trigger);
		const listbox = view.getByRole("listbox", { name: "Branches" });
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(trigger.getAttribute("aria-controls")).toBe(listbox.id);
		expect(
			view
				.getAllByRole("group")
				.map(
					(group) =>
						group.getAttribute("aria-labelledby") &&
						document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent,
				),
		).toEqual(["Local", "Remote"]);
		expect(view.getAllByRole("option").length).toBe(5);
		expect(view.getByRole("option", { name: /stale/ }).getAttribute("aria-disabled")).toBe("true");
	});

	test("keyboard: ArrowDown opens, arrows skip disabled options, Enter picks", () => {
		const seen: string[] = [];
		const { view } = renderWithOverlay(<SelectHarness onChange={(v) => seen.push(v)} />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		act(() => trigger.focus());
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
		const activeName = () =>
			document.getElementById(trigger.getAttribute("aria-activedescendant") ?? "")?.textContent;
		expect(activeName()).toBe("main");
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
		expect(activeName()).toBe("origin/main");
		fireEvent.keyDown(trigger, { key: "ArrowUp" });
		expect(activeName()).toBe("feature/login2 days ago");
		fireEvent.keyDown(trigger, { key: "End" });
		expect(activeName()).toBe("origin/release");
		fireEvent.keyDown(trigger, { key: "Enter" });
		expect(seen).toEqual(["origin/release"]);
		expect(view.queryByRole("listbox")).toBeNull();
		expect(trigger.textContent).toBe("origin/release");
		expect(document.activeElement).toBe(trigger);
	});

	test("reopening activates the selected option and marks it aria-selected", () => {
		const { view } = renderWithOverlay(<SelectHarness />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		fireEvent.click(trigger);
		fireEvent.click(view.getByRole("option", { name: "origin/main" }));
		fireEvent.click(trigger);
		const selected = view.getByRole("option", { name: "origin/main" });
		expect(selected.getAttribute("aria-selected")).toBe("true");
		expect(trigger.getAttribute("aria-activedescendant")).toBe(selected.id);
	});

	test("the selected label is also the value's hover text, for a truncated trigger", () => {
		const { view } = renderWithOverlay(<SelectHarness />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		const value = trigger.querySelector(".rf-select-value");
		expect(value?.getAttribute("title")).toBeNull();
		fireEvent.click(trigger);
		fireEvent.click(view.getByRole("option", { name: "origin/main" }));
		expect(value?.getAttribute("title")).toBe("origin/main");
	});

	test("typeahead jumps to the next option starting with the typed character", () => {
		const { view } = renderWithOverlay(<SelectHarness />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		fireEvent.keyDown(trigger, { key: "Enter" });
		fireEvent.keyDown(trigger, { key: "o" });
		expect(
			document.getElementById(trigger.getAttribute("aria-activedescendant") ?? "")?.textContent,
		).toBe("origin/main");
		fireEvent.keyDown(trigger, { key: "o" });
		expect(
			document.getElementById(trigger.getAttribute("aria-activedescendant") ?? "")?.textContent,
		).toBe("origin/release");
	});

	test("Escape closes without picking; disabled options ignore clicks", () => {
		const seen: string[] = [];
		const { view } = renderWithOverlay(<SelectHarness onChange={(v) => seen.push(v)} />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		fireEvent.click(trigger);
		fireEvent.click(view.getByRole("option", { name: "stale" }));
		expect(view.getByRole("listbox")).toBeDefined();
		fireEvent.keyDown(trigger, { key: "Escape" });
		expect(view.queryByRole("listbox")).toBeNull();
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(seen).toEqual([]);
	});

	test("a pointer down outside closes the list; on the trigger it toggles", () => {
		const { view } = renderWithOverlay(<SelectHarness />);
		const trigger = view.getByRole("combobox", { name: "Base branch" });
		fireEvent.click(trigger);
		fireEvent.pointerDown(document.body);
		expect(view.queryByRole("listbox")).toBeNull();
		fireEvent.click(trigger);
		fireEvent.pointerDown(trigger);
		expect(view.getByRole("listbox")).toBeDefined();
		fireEvent.click(trigger);
		expect(view.queryByRole("listbox")).toBeNull();
	});

	test("disabled select does not open and a Field names it", () => {
		const { view } = renderWithOverlay(
			<Field label="Compare base" disabled error="No branches">
				<Select value={null} options={BRANCHES} onChange={() => {}} />
			</Field>,
		);
		const trigger = view.getByRole("combobox", { name: "Compare base" }) as HTMLButtonElement;
		expect(trigger.disabled).toBe(true);
		expect(trigger.getAttribute("aria-invalid")).toBe("true");
		fireEvent.click(trigger);
		expect(view.queryByRole("listbox")).toBeNull();
	});
});

function ComboHarness({ onChange }: { readonly onChange?: (value: string) => void }) {
	const [value, setValue] = useState<string | null>("main");
	return (
		<Combobox
			aria-label="Branch"
			listLabel="Branches"
			emptyLabel="No matching branch"
			value={value}
			options={BRANCHES}
			onChange={(next) => {
				onChange?.(next);
				setValue(next);
			}}
		/>
	);
}

describe("Combobox", () => {
	test("autoFocus focuses the input when it mounts", () => {
		const { view } = renderWithOverlay(
			<Combobox aria-label="Base" value="main" options={BRANCHES} onChange={() => {}} autoFocus />,
		);
		expect(document.activeElement).toBe(view.getByRole("combobox", { name: "Base" }));
	});

	test("focus selects the label, so typing starts a new query", () => {
		const { view } = renderWithOverlay(<ComboHarness />);
		const input = view.getByRole("combobox", { name: "Branch" }) as HTMLInputElement;
		act(() => input.focus());
		expect([input.selectionStart, input.selectionEnd]).toEqual([0, "main".length]);
	});

	test("shows the selected label while closed", () => {
		const { view } = renderWithOverlay(<ComboHarness />);
		const input = view.getByRole("combobox", { name: "Branch" }) as HTMLInputElement;
		expect(input.value).toBe("main");
		expect(input.getAttribute("aria-autocomplete")).toBe("list");
		expect(input.getAttribute("aria-expanded")).toBe("false");
	});

	test("typing filters options and drops groups without matches", () => {
		const { view } = renderWithOverlay(<ComboHarness />);
		const input = view.getByRole("combobox", { name: "Branch" });
		fireEvent.change(input, { target: { value: "release" } });
		expect(view.getAllByRole("option").map((option) => option.textContent)).toEqual([
			"origin/release",
		]);
		expect(view.getAllByRole("group").length).toBe(1);
		expect(input.getAttribute("aria-activedescendant")).toBe(view.getByRole("option").id);
	});

	test("ArrowDown and Enter pick a filtered option and close", () => {
		const seen: string[] = [];
		const { view } = renderWithOverlay(<ComboHarness onChange={(v) => seen.push(v)} />);
		const input = view.getByRole("combobox", { name: "Branch" }) as HTMLInputElement;
		// The closed input shows "main"; typing a different string is what opens the list.
		fireEvent.change(input, { target: { value: "mai" } });
		expect(view.getAllByRole("option").map((option) => option.textContent)).toEqual([
			"main",
			"origin/main",
		]);
		fireEvent.keyDown(input, { key: "ArrowDown" });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(seen).toEqual(["origin/main"]);
		expect(view.queryByRole("listbox")).toBeNull();
		expect(input.value).toBe("origin/main");
	});

	test("no matches shows the empty label and Enter does nothing", () => {
		const seen: string[] = [];
		const { view } = renderWithOverlay(<ComboHarness onChange={(v) => seen.push(v)} />);
		const input = view.getByRole("combobox", { name: "Branch" });
		fireEvent.change(input, { target: { value: "zzz" } });
		expect(view.queryAllByRole("option")).toEqual([]);
		expect(view.getByText("No matching branch")).toBeDefined();
		fireEvent.keyDown(input, { key: "Enter" });
		expect(seen).toEqual([]);
	});

	test("Escape closes the list and keeps the value; clicking an option picks it", () => {
		const seen: string[] = [];
		const { view } = renderWithOverlay(<ComboHarness onChange={(v) => seen.push(v)} />);
		const input = view.getByRole("combobox", { name: "Branch" }) as HTMLInputElement;
		fireEvent.keyDown(input, { key: "ArrowDown" });
		expect(view.getAllByRole("option").length).toBe(5);
		fireEvent.keyDown(input, { key: "Escape" });
		expect(view.queryByRole("listbox")).toBeNull();
		expect(input.value).toBe("main");
		fireEvent.click(input);
		fireEvent.click(view.getByRole("option", { name: /feature\/login/ }));
		expect(seen).toEqual(["feature/login"]);
	});

	test("matchOption matches label or value, case-insensitively", () => {
		const option = { value: "origin/Main", label: "Main branch" };
		expect(matchOption(option, "MAIN")).toBe(true);
		expect(matchOption(option, "origin")).toBe(true);
		expect(matchOption(option, "  ")).toBe(true);
		expect(matchOption(option, "dev")).toBe(false);
	});
});
