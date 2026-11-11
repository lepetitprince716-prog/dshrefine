// Build the bundle: the empty host half as Node ESM and the browser module as a
// __ModuleLoader__ factory. Run from anywhere with `bun bundles/split/build.ts`.
import { rm } from "node:fs/promises";
import { join } from "node:path";
import pkg from "./package.json" with { type: "json" };

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");

/** The fixed browser module table (docs/notes/dsh-client-api.md section 0.1); the rest is bundled. */
const CLIENT_EXTERNALS = [
	"react",
	"react/*",
	"react-dom",
	"react-dom/*",
	"@deepseek-ai/*",
	"zod",
	"@tanstack/react-virtual",
];

function report(label: string, result: Bun.BuildOutput): void {
	if (!result.success) {
		for (const log of result.logs) console.error(log);
		throw new Error(`${label} build failed`);
	}
	for (const output of result.outputs)
		console.log(`${label}: ${output.path.slice(ROOT.length + 1)} ${output.size} B`);
}

await rm(DIST, { recursive: true, force: true });

report(
	"host",
	await Bun.build({
		entrypoints: [join(ROOT, "src", "index.ts")],
		outdir: DIST,
		target: "node",
		format: "esm",
		naming: { entry: "index.js" },
		sourcemap: "none",
	}),
);

report(
	"client",
	await Bun.build({
		entrypoints: [join(ROOT, "src", "client", "index.tsx")],
		outdir: DIST,
		target: "browser",
		format: "cjs",
		external: CLIENT_EXTERNALS,
		define: { "process.env.NODE_ENV": JSON.stringify("production") },
		banner: `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;`,
		footer: "return module.exports;}});",
		naming: { entry: "client.js" },
		sourcemap: "none",
	}),
);
