import "./register.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { useState } from "react";
import { tokensCss } from "../tokens.ts";
import { loadTestingLibrary, releaseDomAfterAll } from "./index.ts";

const { cleanup, fireEvent, render } = await loadTestingLibrary();
releaseDomAfterAll(afterAll);
afterEach(cleanup);

function Counter() {
	const [count, setCount] = useState(0);
	return (
		<button type="button" aria-label="increment" onClick={() => setCount(count + 1)}>
			{count}
		</button>
	);
}

describe("dom test harness", () => {
	test("renders, queries by role and dispatches events", () => {
		const view = render(<Counter />);
		const button = view.getByRole("button", { name: "increment" });
		expect(button.textContent).toBe("0");
		fireEvent.click(button);
		expect(button.textContent).toBe("1");
	});

	test("controlled inputs receive change events", () => {
		const seen: string[] = [];
		const view = render(<input aria-label="name" onChange={(e) => seen.push(e.target.value)} />);
		fireEvent.change(view.getByRole("textbox", { name: "name" }), { target: { value: "abc" } });
		expect(seen).toEqual(["abc"]);
	});

	test("tokens css scopes every alias under the root class", () => {
		const css = tokensCss();
		expect(css.startsWith(".rf-root{")).toBe(true);
		expect(css).toContain("--refine-s4:16px;");
		expect(css).not.toContain("#");
	});
});
