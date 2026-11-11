import { BASE_CSS } from "./base/css.ts";
import { DATA_CSS } from "./data/css.ts";
import { tokensCss } from "./tokens.ts";

/**
 * The complete stylesheet of the kit: token aliases first, then component rules. The bundle
 * injects it once, tagged with `data-plugin`, so the module system removes it on unload.
 */
export function uiCss(): string {
	return [tokensCss(), BASE_CSS, DATA_CSS].join("\n");
}
