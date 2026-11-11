import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { Button, Chip, Divider, IconButton, Kbd, Spinner, StatusDot } from "./primitives.tsx";

const { cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

const Glyph = () => <svg data-testid="glyph" />;

describe("Button", () => {
	test("defaults to a secondary md button of type button and fires onClick", () => {
		let clicks = 0;
		const view = render(<Button onClick={() => clicks++}>Save</Button>);
		const button = view.getByRole("button", { name: "Save" });
		expect(button.getAttribute("type")).toBe("button");
		expect(button.className).toBe("rf-btn rf-btn-secondary rf-btn-md");
		fireEvent.click(button);
		expect(clicks).toBe(1);
	});

	test("variant, size and submit type are reflected", () => {
		const view = render(
			<Button variant="primary" size="sm" type="submit">
				Create
			</Button>,
		);
		const button = view.getByRole("button", { name: "Create" });
		expect(button.className).toContain("rf-btn-primary");
		expect(button.className).toContain("rf-btn-sm");
		expect(button.getAttribute("type")).toBe("submit");
	});

	test("danger and ghost variants get their classes", () => {
		const view = render(
			<>
				<Button variant="danger">Remove</Button>
				<Button variant="ghost">Open</Button>
			</>,
		);
		expect(view.getByRole("button", { name: "Remove" }).className).toContain("rf-btn-danger");
		expect(view.getByRole("button", { name: "Open" }).className).toContain("rf-btn-ghost");
	});

	test("disabled buttons do not fire onClick", () => {
		let clicks = 0;
		const view = render(
			<Button disabled onClick={() => clicks++}>
				Save
			</Button>,
		);
		const button = view.getByRole("button", { name: "Save" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		fireEvent.click(button);
		expect(clicks).toBe(0);
	});

	test("loading shows a spinner, sets aria-busy and ignores clicks", () => {
		let clicks = 0;
		const view = render(
			<Button loading icon={<Glyph />} onClick={() => clicks++}>
				Save
			</Button>,
		);
		const button = view.getByRole("button", { name: "Save" });
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.querySelector(".rf-spinner")).not.toBeNull();
		expect(view.queryByTestId("glyph")).toBeNull();
		fireEvent.click(button);
		expect(clicks).toBe(0);
	});

	test("icon is decorative and icon-only hides the label", () => {
		const view = render(
			<Button iconOnly icon={<Glyph />} aria-label="Refresh">
				Hidden
			</Button>,
		);
		const button = view.getByRole("button", { name: "Refresh" });
		expect(button.className).toContain("rf-btn-icon");
		expect(button.querySelector(".rf-btn-glyph")?.getAttribute("aria-hidden")).toBe("true");
		expect(button.textContent).toBe("");
	});
});

describe("IconButton", () => {
	test("uses label as its accessible name and defaults to ghost", () => {
		let clicks = 0;
		const view = render(<IconButton icon={<Glyph />} label="Close" onClick={() => clicks++} />);
		const button = view.getByRole("button", { name: "Close" });
		expect(button.className).toContain("rf-btn-ghost");
		expect(button.className).toContain("rf-btn-icon");
		fireEvent.click(button);
		expect(clicks).toBe(1);
	});
});

describe("Chip", () => {
	test("renders a non-interactive span with tone and mono classes", () => {
		const view = render(
			<Chip tone="success" mono title="abc1234 full">
				abc1234
			</Chip>,
		);
		const chip = view.getByText("abc1234").parentElement as HTMLElement;
		expect(chip.tagName).toBe("SPAN");
		expect(chip.className).toBe("rf-chip rf-chip-success rf-chip-mono");
		expect(chip.getAttribute("title")).toBe("abc1234 full");
		expect(view.queryByRole("button")).toBeNull();
	});

	test("becomes a button with onClick and respects disabled", () => {
		let clicks = 0;
		const view = render(
			<>
				<Chip tone="info" onClick={() => clicks++}>
					#42
				</Chip>
				<Chip tone="warn" onClick={() => clicks++} disabled aria-label="3 dirty files">
					3 dirty
				</Chip>
			</>,
		);
		fireEvent.click(view.getByRole("button", { name: "#42" }));
		const disabled = view.getByRole("button", { name: "3 dirty files" }) as HTMLButtonElement;
		expect(disabled.disabled).toBe(true);
		fireEvent.click(disabled);
		expect(clicks).toBe(1);
	});

	for (const tone of ["neutral", "success", "warn", "error", "info", "business"] as const) {
		test(`tone ${tone} maps to rf-chip-${tone}`, () => {
			const view = render(<Chip tone={tone}>x</Chip>);
			expect(view.getByText("x").parentElement?.className).toContain(`rf-chip-${tone}`);
		});
	}
});

describe("StatusDot", () => {
	test("is decorative without a label", () => {
		const view = render(<StatusDot status="running" />);
		const dot = view.container.querySelector(".rf-status-dot");
		expect(dot?.getAttribute("aria-hidden")).toBe("true");
		expect(dot?.getAttribute("data-status")).toBe("running");
	});

	test("exposes its label as an image name", () => {
		const view = render(<StatusDot status="attention" label="Needs input" />);
		expect(view.getByRole("img", { name: "Needs input" }).getAttribute("data-status")).toBe(
			"attention",
		);
	});
});

describe("small primitives", () => {
	test("Kbd renders a kbd element", () => {
		const view = render(<Kbd>Enter</Kbd>);
		expect(view.getByText("Enter").tagName).toBe("KBD");
	});

	test("Divider is a separator with orientation", () => {
		const view = render(<Divider orientation="vertical" />);
		expect(view.getByRole("separator").getAttribute("aria-orientation")).toBe("vertical");
	});

	test("Spinner announces a status only when labelled", () => {
		const view = render(
			<>
				<Spinner label="Loading" />
				<Spinner />
			</>,
		);
		expect(view.getByRole("status", { name: "Loading" })).toBeDefined();
		expect(view.container.querySelectorAll('.rf-spinner[aria-hidden="true"]').length).toBe(1);
	});
});
