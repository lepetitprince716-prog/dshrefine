import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { useState } from "react";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { Field, TextArea, TextInput } from "./field.tsx";
import { Checkbox, SegmentedTabs, Switch } from "./toggles.tsx";

const { act, cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

describe("Field with TextInput", () => {
	test("labels the control and links description and error", () => {
		const view = render(
			<Field label="Name" description="Shown in the sidebar" error="Required">
				<TextInput defaultValue="" />
			</Field>,
		);
		const input = view.getByRole("textbox", { name: "Name" });
		const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];
		expect(describedBy.length).toBe(2);
		expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual([
			"Shown in the sidebar",
			"Required",
		]);
		expect(input.getAttribute("aria-invalid")).toBe("true");
	});

	test("without an error the control is not invalid and only the description is linked", () => {
		const view = render(
			<Field label="Name" description="Hint">
				<TextInput />
			</Field>,
		);
		const input = view.getByRole("textbox", { name: "Name" });
		expect(input.getAttribute("aria-invalid")).toBeNull();
		expect(document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
			"Hint",
		);
	});

	test("disabled and required flow from the field; own props win", () => {
		const view = render(
			<>
				<Field label="A" disabled required>
					<TextInput />
				</Field>
				<Field label="B" disabled id="own-id">
					<TextInput disabled={false} id="ignored" />
				</Field>
			</>,
		);
		const a = view.getByRole("textbox", { name: "A" }) as HTMLInputElement;
		const b = view.getByRole("textbox", { name: "B" }) as HTMLInputElement;
		expect(a.disabled).toBe(true);
		expect(a.required).toBe(true);
		expect(b.disabled).toBe(false);
		expect(b.id).toBe("own-id");
	});

	test("onValueChange and native onChange both receive edits", () => {
		const values: string[] = [];
		let native = 0;
		const view = render(
			<TextInput
				aria-label="Query"
				onValueChange={(v) => values.push(v)}
				onChange={() => native++}
			/>,
		);
		fireEvent.change(view.getByRole("textbox", { name: "Query" }), { target: { value: "main" } });
		expect(values).toEqual(["main"]);
		expect(native).toBe(1);
	});
});

describe("TextArea", () => {
	test("grows to its scroll height and caps at maxRows", () => {
		function Controlled() {
			const [value, setValue] = useState("");
			return <TextArea aria-label="Body" value={value} onValueChange={setValue} maxRows={3} />;
		}
		const view = render(<Controlled />);
		const area = view.getByRole("textbox", { name: "Body" }) as HTMLTextAreaElement;
		let content = 40;
		Object.defineProperty(area, "scrollHeight", { configurable: true, get: () => content });
		fireEvent.change(area, { target: { value: "one\ntwo" } });
		expect(area.style.height).toBe("40px");
		expect(area.style.overflowY).toBe("hidden");
		content = 400;
		fireEvent.change(area, { target: { value: "many\nlines\nmore\nmore\nmore" } });
		const cap = Number.parseFloat(area.style.height);
		expect(cap).toBeLessThan(400);
		expect(cap).toBeGreaterThanOrEqual(60);
		expect(area.style.overflowY).toBe("auto");
	});

	test("starts with minRows rows and joins a field", () => {
		const view = render(
			<Field label="Notes" error="Too long">
				<TextArea minRows={4} />
			</Field>,
		);
		const area = view.getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement;
		expect(area.getAttribute("rows")).toBe("4");
		expect(area.getAttribute("aria-invalid")).toBe("true");
	});
});

describe("Switch", () => {
	function Harness({ disabled = false }: { readonly disabled?: boolean }) {
		const [on, setOn] = useState(false);
		return <Switch checked={on} onChange={setOn} label="Draft" disabled={disabled} />;
	}

	test("exposes role switch with aria-checked and toggles on click and label click", () => {
		const view = render(<Harness />);
		const control = view.getByRole("switch", { name: "Draft" });
		expect(control.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(control);
		expect(control.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(view.getByText("Draft"));
		expect(control.getAttribute("aria-checked")).toBe("false");
	});

	test("disabled switches do not toggle", () => {
		const view = render(<Harness disabled />);
		const control = view.getByRole("switch", { name: "Draft" });
		fireEvent.click(control);
		expect(control.getAttribute("aria-checked")).toBe("false");
	});

	test("takes its name from an enclosing Field", () => {
		const view = render(
			<Field label="Auto review" description="Runs after each step">
				<Switch checked onChange={() => {}} />
			</Field>,
		);
		const control = view.getByRole("switch", { name: "Auto review" });
		expect(control.getAttribute("aria-checked")).toBe("true");
		expect(control.getAttribute("aria-describedby")).not.toBeNull();
	});
});

describe("Checkbox", () => {
	test("toggles through the native checkbox and reports the new state", () => {
		const seen: boolean[] = [];
		function Harness() {
			const [on, setOn] = useState(false);
			return (
				<Checkbox
					checked={on}
					onChange={(next) => {
						seen.push(next);
						setOn(next);
					}}
					label="Include untracked"
				/>
			);
		}
		const view = render(<Harness />);
		const box = view.getByRole("checkbox", { name: "Include untracked" }) as HTMLInputElement;
		fireEvent.click(box);
		expect(box.checked).toBe(true);
		fireEvent.click(view.getByText("Include untracked"));
		expect(box.checked).toBe(false);
		expect(seen).toEqual([true, false]);
	});

	test("indeterminate sets the native mixed state", () => {
		const view = render(
			<Checkbox checked={false} indeterminate onChange={() => {}} aria-label="All" />,
		);
		const box = view.getByRole("checkbox", { name: "All" }) as HTMLInputElement;
		expect(box.indeterminate).toBe(true);
	});

	test("disabled checkboxes do not report changes", () => {
		const seen: boolean[] = [];
		const view = render(
			<Checkbox checked={false} disabled onChange={(v) => seen.push(v)} label="Locked" />,
		);
		const box = view.getByRole("checkbox", { name: "Locked" }) as HTMLInputElement;
		expect(box.disabled).toBe(true);
		fireEvent.click(box);
		expect(seen).toEqual([]);
	});
});

describe("SegmentedTabs", () => {
	function Harness({ onChange }: { readonly onChange?: (value: string) => void }) {
		const [value, setValue] = useState<"unified" | "split" | "raw">("unified");
		return (
			<SegmentedTabs
				label="Diff mode"
				value={value}
				onChange={(next) => {
					onChange?.(next);
					setValue(next);
				}}
				items={[
					{ value: "unified", label: "Unified" },
					{ value: "raw", label: "Raw", disabled: true },
					{ value: "split", label: "Split" },
				]}
			/>
		);
	}

	test("renders a tablist with one selected, tabbable tab", () => {
		const view = render(<Harness />);
		expect(view.getByRole("tablist", { name: "Diff mode" })).toBeDefined();
		const unified = view.getByRole("tab", { name: "Unified" });
		expect(unified.getAttribute("aria-selected")).toBe("true");
		expect(unified.tabIndex).toBe(0);
		expect(view.getByRole("tab", { name: "Split" }).tabIndex).toBe(-1);
	});

	test("arrow keys skip disabled tabs, move focus and select", () => {
		const seen: string[] = [];
		const view = render(<Harness onChange={(v) => seen.push(v)} />);
		const unified = view.getByRole("tab", { name: "Unified" });
		act(() => unified.focus());
		fireEvent.keyDown(unified, { key: "ArrowRight" });
		const split = view.getByRole("tab", { name: "Split" });
		expect(document.activeElement).toBe(split);
		expect(split.getAttribute("aria-selected")).toBe("true");
		fireEvent.keyDown(split, { key: "ArrowRight" });
		expect(document.activeElement).toBe(unified);
		fireEvent.keyDown(unified, { key: "End" });
		expect(seen).toEqual(["split", "unified", "split"]);
	});

	test("clicking selects; clicking the selected tab does not re-fire", () => {
		const seen: string[] = [];
		const view = render(<Harness onChange={(v) => seen.push(v)} />);
		fireEvent.click(view.getByRole("tab", { name: "Unified" }));
		fireEvent.click(view.getByRole("tab", { name: "Split" }));
		fireEvent.click(view.getByRole("tab", { name: "Raw" }));
		expect(seen).toEqual(["split"]);
	});
});
