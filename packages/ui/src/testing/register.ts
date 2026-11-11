import { installDom } from "./dom.ts";

// Side-effect module: import it as the FIRST line of a DOM test file (`import "…/register.ts";`).
// react-dom decides at load time whether a DOM exists, so happy-dom must be installed before
// React or Testing Library are evaluated. Biome keeps bare imports in place when sorting.
export { DOM_URL } from "./dom.ts";

installDom();
