import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, jest, test } from "bun:test";
import { type ReactNode, useRef, useState } from "react";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { createOverlayStore } from "./overlay.ts";
import { OverlayLayer, OverlayProvider } from "./overlay-layer.tsx";
import { Menu, type MenuEntry, Modal, Popover, TOOLTIP_DELAY_MS, Tooltip } from "./popups.tsx";
import { Button } from "./primitives.tsx";

const { act, cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(() => {
	cleanup();
	jest.useRealTimers();
});

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

function ModalHarness({
	dismissible,
	closeOnMask,
	onClose,
}: {
	readonly dismissible?: boolean;
	readonly closeOnMask?: boolean;
	readonly onClose?: () => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen(true)}>Rename</Button>
			<Modal
				open={open}
				onClose={() => {
					onClose?.();
					setOpen(false);
				}}
				title="Rename workspace"
				description="The branch keeps its name."
				closeLabel="Close"
				{...(dismissible === undefined ? {} : { dismissible })}
				{...(closeOnMask === undefined ? {} : { closeOnMask })}
				footer={
					<>
						<Button onClick={() => setOpen(false)}>Cancel</Button>
						<Button variant="primary">Save</Button>
					</>
				}
			>
				<input aria-label="Name" />
			</Modal>
		</>
	);
}

function openModal(view: ReturnType<typeof render>) {
	const opener = view.getByRole("button", { name: "Rename" });
	act(() => opener.focus());
	fireEvent.click(opener);
	return { opener, dialog: view.getByRole("dialog", { name: "Rename workspace" }) };
}

describe("Modal", () => {
	test("renders an aria-modal dialog labelled by its title and described by its description", () => {
		const { view } = renderWithOverlay(<ModalHarness />);
		expect(view.queryByRole("dialog")).toBeNull();
		const { dialog } = openModal(view);
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(
			document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent,
		).toBe("The branch keeps its name.");
		expect(dialog.closest(".rf-overlay")?.classList.contains("rf-root")).toBe(true);
	});

	test("focuses the first field, traps Tab in both directions, and Escape returns focus", () => {
		let closed = 0;
		const { view } = renderWithOverlay(<ModalHarness onClose={() => closed++} />);
		const { opener, dialog } = openModal(view);
		const name = view.getByRole("textbox", { name: "Name" });
		const close = view.getByRole("button", { name: "Close" });
		const save = view.getByRole("button", { name: "Save" });
		expect(document.activeElement).toBe(name);
		act(() => save.focus());
		fireEvent.keyDown(save, { key: "Tab" });
		expect(document.activeElement).toBe(close);
		fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
		expect(document.activeElement).toBe(save);
		fireEvent.keyDown(dialog, { key: "Escape" });
		expect(view.queryByRole("dialog")).toBeNull();
		expect(closed).toBe(1);
		expect(document.activeElement).toBe(opener);
	});

	test("the close button and a mask click close it; a click inside the dialog does not", () => {
		let closed = 0;
		const { view } = renderWithOverlay(<ModalHarness onClose={() => closed++} />);
		openModal(view);
		fireEvent.click(view.getByRole("button", { name: "Close" }));
		expect(view.queryByRole("dialog")).toBeNull();
		const { dialog } = openModal(view);
		fireEvent.pointerDown(dialog);
		fireEvent.click(dialog);
		expect(view.getByRole("dialog")).toBeDefined();
		const mask = dialog.parentElement as HTMLElement;
		fireEvent.pointerDown(mask);
		fireEvent.click(mask);
		expect(view.queryByRole("dialog")).toBeNull();
		expect(closed).toBe(2);
	});

	test("closeOnMask false keeps it open on mask click but Escape still closes", () => {
		const { view } = renderWithOverlay(<ModalHarness closeOnMask={false} />);
		const { dialog } = openModal(view);
		const mask = dialog.parentElement as HTMLElement;
		fireEvent.pointerDown(mask);
		fireEvent.click(mask);
		expect(view.getByRole("dialog")).toBeDefined();
		fireEvent.keyDown(dialog, { key: "Escape" });
		expect(view.queryByRole("dialog")).toBeNull();
	});

	test("non-dismissible: no close button, Escape and mask ignored, footer action closes", () => {
		let closed = 0;
		const { view } = renderWithOverlay(
			<ModalHarness dismissible={false} onClose={() => closed++} />,
		);
		const { opener, dialog } = openModal(view);
		expect(view.queryByRole("button", { name: "Close" })).toBeNull();
		fireEvent.keyDown(dialog, { key: "Escape" });
		const mask = dialog.parentElement as HTMLElement;
		fireEvent.pointerDown(mask);
		fireEvent.click(mask);
		expect(view.getByRole("dialog")).toBeDefined();
		fireEvent.click(view.getByRole("button", { name: "Cancel" }));
		expect(view.queryByRole("dialog")).toBeNull();
		expect(closed).toBe(0);
		expect(document.activeElement).toBe(opener);
	});
});

function MenuHarness({ items }: { readonly items: readonly MenuEntry[] }) {
	const anchor = useRef<HTMLButtonElement | null>(null);
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button ref={anchor} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
				More
			</Button>
			<Menu
				open={open}
				onClose={() => setOpen(false)}
				anchorRef={anchor}
				items={items}
				label="Workspace actions"
			/>
		</>
	);
}

describe("Menu", () => {
	const selected: string[] = [];
	const items: MenuEntry[] = [
		{ id: "rename", label: "Rename", onSelect: () => selected.push("rename"), shortcut: "F2" },
		{ id: "copy", label: "Copy path", onSelect: () => selected.push("copy") },
		{ id: "shelve", label: "Shelve", onSelect: () => selected.push("shelve"), disabled: true },
		{ kind: "separator", id: "sep" },
		{ id: "remove", label: "Remove", onSelect: () => selected.push("remove"), danger: true },
	];

	function openMenu(view: ReturnType<typeof render>) {
		const anchor = view.getByRole("button", { name: "More" });
		act(() => anchor.focus());
		fireEvent.click(anchor);
		return { anchor, menu: view.getByRole("menu", { name: "Workspace actions" }) };
	}

	test("opens a role=menu of menuitems with a separator and focuses the first item", () => {
		const { view } = renderWithOverlay(<MenuHarness items={items} />);
		openMenu(view);
		const entries = view.getAllByRole("menuitem");
		expect(entries.map((entry) => entry.textContent)).toEqual([
			"RenameF2",
			"Copy path",
			"Shelve",
			"Remove",
		]);
		expect(view.getByRole("separator")).toBeDefined();
		expect(document.activeElement).toBe(entries[0] ?? null);
		expect(view.getByRole("menuitem", { name: "Shelve" }).getAttribute("aria-disabled")).toBe(
			"true",
		);
		expect(view.getByRole("menuitem", { name: "Remove" }).getAttribute("data-danger")).toBe("true");
	});

	test("arrows skip disabled items and wrap; Home, End and typeahead move focus", () => {
		const { view } = renderWithOverlay(<MenuHarness items={items} />);
		const { menu } = openMenu(view);
		const name = () => document.activeElement?.textContent;
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(name()).toBe("Copy path");
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(name()).toBe("Remove");
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(name()).toBe("RenameF2");
		fireEvent.keyDown(menu, { key: "ArrowUp" });
		expect(name()).toBe("Remove");
		fireEvent.keyDown(menu, { key: "Home" });
		expect(name()).toBe("RenameF2");
		fireEvent.keyDown(menu, { key: "End" });
		expect(name()).toBe("Remove");
		fireEvent.keyDown(menu, { key: "c" });
		expect(name()).toBe("Copy path");
	});

	test("Escape closes and returns focus to the anchor", () => {
		const { view } = renderWithOverlay(<MenuHarness items={items} />);
		const { anchor, menu } = openMenu(view);
		fireEvent.keyDown(menu, { key: "Escape" });
		expect(view.queryByRole("menu")).toBeNull();
		expect(anchor.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(anchor);
	});

	test("selecting an item closes the menu, then runs onSelect; disabled items do nothing", () => {
		selected.length = 0;
		const { view } = renderWithOverlay(<MenuHarness items={items} />);
		openMenu(view);
		fireEvent.click(view.getByRole("menuitem", { name: "Shelve" }));
		expect(view.getByRole("menu")).toBeDefined();
		fireEvent.click(view.getByRole("menuitem", { name: "Copy path" }));
		expect(selected).toEqual(["copy"]);
		expect(view.queryByRole("menu")).toBeNull();
	});

	test("Tab and an outside pointer down close the menu", () => {
		const { view } = renderWithOverlay(<MenuHarness items={items} />);
		const { menu } = openMenu(view);
		fireEvent.keyDown(menu, { key: "Tab" });
		expect(view.queryByRole("menu")).toBeNull();
		openMenu(view);
		fireEvent.pointerDown(document.body);
		expect(view.queryByRole("menu")).toBeNull();
	});
});

function PopoverHarness({ autoFocus }: { readonly autoFocus?: boolean }) {
	const anchor = useRef<HTMLButtonElement | null>(null);
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button ref={anchor} onClick={() => setOpen(!open)}>
				Filter
			</Button>
			<Popover
				open={open}
				onClose={() => setOpen(false)}
				anchorRef={anchor}
				label="Filters"
				{...(autoFocus === undefined ? {} : { autoFocus })}
			>
				<input aria-label="Status" />
			</Popover>
		</>
	);
}

describe("Popover", () => {
	test("opens an anchored dialog, focuses inside, and closes on outside pointer down", () => {
		const { view } = renderWithOverlay(<PopoverHarness />);
		const anchor = view.getByRole("button", { name: "Filter" });
		act(() => anchor.focus());
		fireEvent.click(anchor);
		const surface = view.getByRole("dialog", { name: "Filters" });
		expect(surface.closest(".rf-anchored-layer")).not.toBeNull();
		expect(document.activeElement).toBe(view.getByRole("textbox", { name: "Status" }));
		fireEvent.pointerDown(view.getByRole("textbox", { name: "Status" }));
		expect(view.getByRole("dialog")).toBeDefined();
		fireEvent.pointerDown(document.body);
		expect(view.queryByRole("dialog")).toBeNull();
	});

	test("autoFocus false leaves focus on the anchor", () => {
		const { view } = renderWithOverlay(<PopoverHarness autoFocus={false} />);
		const anchor = view.getByRole("button", { name: "Filter" });
		act(() => anchor.focus());
		fireEvent.click(anchor);
		expect(view.getByRole("dialog")).toBeDefined();
		expect(document.activeElement).toBe(anchor);
	});
});

describe("Tooltip", () => {
	test("appears after the delay on hover and hides on leave", () => {
		jest.useFakeTimers();
		const { view } = renderWithOverlay(
			<Tooltip label="Copy path">
				<button type="button">copy</button>
			</Tooltip>,
		);
		const trigger = view.getByRole("button", { name: "copy" });
		fireEvent.mouseEnter(trigger.parentElement as HTMLElement);
		act(() => {
			jest.advanceTimersByTime(TOOLTIP_DELAY_MS - 1);
		});
		expect(view.queryByRole("tooltip")).toBeNull();
		act(() => {
			jest.advanceTimersByTime(1);
		});
		const tooltip = view.getByRole("tooltip");
		expect(tooltip.textContent).toBe("Copy path");
		expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
		fireEvent.mouseLeave(trigger.parentElement as HTMLElement);
		expect(view.queryByRole("tooltip")).toBeNull();
		expect(trigger.getAttribute("aria-describedby")).toBeNull();
	});

	test("appears on keyboard focus after the delay; Escape hides it without moving focus", () => {
		jest.useFakeTimers();
		const { view } = renderWithOverlay(
			<Tooltip label="Refresh">
				<button type="button" aria-describedby="hint">
					refresh
				</button>
			</Tooltip>,
		);
		const trigger = view.getByRole("button", { name: "refresh" });
		act(() => trigger.focus());
		act(() => {
			jest.advanceTimersByTime(TOOLTIP_DELAY_MS);
		});
		const tooltip = view.getByRole("tooltip");
		expect(trigger.getAttribute("aria-describedby")).toBe(`hint ${tooltip.id}`);
		fireEvent.keyDown(trigger, { key: "Escape" });
		expect(view.queryByRole("tooltip")).toBeNull();
		expect(trigger.getAttribute("aria-describedby")).toBe("hint");
		expect(document.activeElement).toBe(trigger);
	});

	test("a leave before the delay cancels it; disabled tooltips never show", () => {
		jest.useFakeTimers();
		const { view } = renderWithOverlay(
			<>
				<Tooltip label="One">
					<button type="button">one</button>
				</Tooltip>
				<Tooltip label="Two" disabled>
					<button type="button">two</button>
				</Tooltip>
			</>,
		);
		const one = view.getByRole("button", { name: "one" }).parentElement as HTMLElement;
		fireEvent.mouseEnter(one);
		fireEvent.mouseLeave(one);
		fireEvent.mouseEnter(view.getByRole("button", { name: "two" }).parentElement as HTMLElement);
		act(() => {
			jest.advanceTimersByTime(TOOLTIP_DELAY_MS * 2);
		});
		expect(view.queryByRole("tooltip")).toBeNull();
	});
});
