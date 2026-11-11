import "../testing/register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { useState } from "react";
import { loadTestingLibrary, releaseDomAfterAll } from "../testing/index.ts";
import { Disclosure, EmptyState, ErrorBanner, ScrollArea, Skeleton } from "./surfaces.tsx";
import { Toast } from "./toast.tsx";

const { cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

describe("Disclosure", () => {
	test("uncontrolled: starts closed, toggles aria-expanded and the panel", () => {
		const view = render(
			<Disclosure title="Shelf" count="(3)">
				<p>shelved rows</p>
			</Disclosure>,
		);
		const trigger = view.getByRole("button", { name: "Shelf (3)" });
		// Browsers join adjacent inline spans without a space; the name needs a real one.
		expect(trigger.textContent).toBe("Shelf (3)");
		const panel = document.getElementById(
			trigger.getAttribute("aria-controls") ?? "",
		) as HTMLElement;
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(panel.hidden).toBe(true);
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(panel.hidden).toBe(false);
		expect(view.getByText("shelved rows")).toBeDefined();
	});

	test("controlled: reports the requested state and follows the prop", () => {
		const seen: boolean[] = [];
		function Harness() {
			const [open, setOpen] = useState(true);
			return (
				<Disclosure
					title="Active"
					open={open}
					onOpenChange={(next) => {
						seen.push(next);
						setOpen(next);
					}}
					actions={<button type="button">add</button>}
				>
					rows
				</Disclosure>
			);
		}
		const view = render(<Harness />);
		const trigger = view.getByRole("button", { name: "Active" });
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(seen).toEqual([false]);
		expect(view.getByRole("button", { name: "add" }).closest(".rf-disclosure-trigger")).toBeNull();
	});
});

describe("EmptyState", () => {
	test("renders title, description, decorative icon and action", () => {
		const view = render(
			<EmptyState
				icon={<svg data-testid="icon" />}
				title="No projects yet"
				description="Open a folder to start."
				action={<button type="button">Open project</button>}
			/>,
		);
		expect(view.getByText("No projects yet")).toBeDefined();
		expect(view.getByText("Open a folder to start.")).toBeDefined();
		expect(view.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
		expect(view.getByRole("button", { name: "Open project" })).toBeDefined();
	});
});

describe("ErrorBanner", () => {
	const error = { code: "PUSH_AUTH_FAILED", message: "Authentication failed for origin" };

	test("is an alert with the message and code; retry and dismiss call back", () => {
		const calls: string[] = [];
		const view = render(
			<ErrorBanner
				error={error}
				title="Push failed"
				onRetry={() => calls.push("retry")}
				retryLabel="Retry"
				onDismiss={() => calls.push("dismiss")}
				dismissLabel="Dismiss"
			/>,
		);
		const alert = view.getByRole("alert");
		expect(alert.textContent).toContain("Push failed");
		expect(alert.textContent).toContain("Authentication failed for origin");
		expect(alert.textContent).toContain("PUSH_AUTH_FAILED");
		fireEvent.click(view.getByRole("button", { name: "Retry" }));
		fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
		expect(calls).toEqual(["retry", "dismiss"]);
	});

	test("retrying shows a busy retry button that ignores clicks; no buttons without labels", () => {
		const calls: string[] = [];
		const view = render(
			<ErrorBanner error={error} onRetry={() => calls.push("retry")} retryLabel="Retry" retrying />,
		);
		const retry = view.getByRole("button", { name: "Retry" });
		expect(retry.getAttribute("aria-busy")).toBe("true");
		fireEvent.click(retry);
		expect(calls).toEqual([]);
		cleanup();
		const bare = render(<ErrorBanner error={error} onRetry={() => {}} />);
		expect(bare.queryAllByRole("button")).toEqual([]);
	});
});

describe("Skeleton", () => {
	test("is hidden from assistive technology and renders the requested lines", () => {
		const view = render(<Skeleton lines={3} radius="sm" />);
		const group = view.container.firstElementChild as HTMLElement;
		expect(group.getAttribute("aria-hidden")).toBe("true");
		const bars = group.querySelectorAll(".rf-skeleton");
		expect(bars.length).toBe(3);
		expect(bars[2]?.classList.contains("rf-skeleton-last")).toBe(true);
		expect(bars[0]?.classList.contains("rf-skeleton-sm")).toBe(true);
	});

	test("a single bar takes explicit dimensions", () => {
		const view = render(<Skeleton width={120} height={16} />);
		const bar = view.container.querySelector(".rf-skeleton") as HTMLElement;
		expect(bar.style.width).toBe("120px");
		expect(bar.style.height).toBe("16px");
		expect(bar.classList.contains("rf-skeleton-last")).toBe(false);
	});
});

describe("ScrollArea", () => {
	test("a labelled area is a focusable named region", () => {
		const view = render(
			<ScrollArea label="Changed files" maxHeight={200} orientation="both">
				<p>content</p>
			</ScrollArea>,
		);
		const region = view.getByRole("region", { name: "Changed files" });
		expect(region.tabIndex).toBe(0);
		expect(region.style.maxHeight).toBe("200px");
		expect(region.getAttribute("data-orientation")).toBe("both");
	});

	test("an unlabelled area is not in the tab order", () => {
		const view = render(
			<ScrollArea>
				<p>content</p>
			</ScrollArea>,
		);
		const area = view.container.querySelector(".rf-scroll") as HTMLElement;
		expect(area.hasAttribute("tabindex")).toBe(false);
		expect(view.queryByRole("region")).toBeNull();
	});
});

describe("Toast", () => {
	test("tone decides the live role; action and dismiss call back", () => {
		const calls: string[] = [];
		const view = render(
			<>
				<Toast text="Saved" tone="success" />
				<Toast
					text="Conflict"
					tone="warn"
					action={{ label: "Open", run: () => calls.push("open") }}
					onClose={() => calls.push("close")}
					closeLabel="Dismiss"
				/>
			</>,
		);
		expect(view.getByRole("status").textContent).toBe("Saved");
		expect(view.getByRole("alert").getAttribute("data-tone")).toBe("warn");
		fireEvent.click(view.getByRole("button", { name: "Open" }));
		fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
		expect(calls).toEqual(["open", "close", "close"]);
	});
});
