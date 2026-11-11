import { installDom, uninstallDom } from "./dom.ts";

// `bun test` preload (see bunfig.toml). react-dom decides at load time whether a DOM exists
// (event support, the change-event path), and Bun shares one module registry across every test
// file of a run. Any file that reaches react-dom without a DOM, such as a non-DOM test that
// imports `@refine/ui` (which loads react-dom through `@tanstack/react-virtual`), would otherwise
// fix that decision for the whole run. Loading react-dom here, inside the shared window, makes
// the result independent of file order and import style; the globals are removed again before
// any test file runs.
installDom();
await import("react-dom");
await import("react-dom/client");
uninstallDom();
