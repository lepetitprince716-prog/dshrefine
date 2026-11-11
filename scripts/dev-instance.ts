// Throwaway dsh instances for developing the dshrefine bundles.
//
//   bun scripts/dev-instance.ts up [--build] [--no-link] [--name n]
//   bun scripts/dev-instance.ts down [--name n]
//   bun scripts/dev-instance.ts status [--name n]
//
// Every instance lives under /private/tmp/dshrefine-dev/<name>; its DSH_HOME is <base>/dshhome.
// The script never signals the instance: `down` prints the kill command to run by hand.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = "/private/tmp/dshrefine-dev";
const REPO = resolve(import.meta.dir, "..");
const BUNDLES: readonly [string, string][] = [
	["@refine/split", join(REPO, "bundles", "split")],
	["@refine/refine", join(REPO, "bundles", "refine")],
];
const NOISE = /trust settings of system certificate|UNDICI-EHPA|trace-warnings/;

interface State {
	name: string;
	pid: number;
	port: number;
	url: string;
	base: string;
	dshHome: string;
	log: string;
	stop: string;
}

function argumentsOf(argv: string[]): {
	command: string;
	name: string;
	flags: Set<string>;
	port: string;
	patch?: string;
} {
	const [command = "help", ...tail] = argv;
	const flags = new Set<string>();
	let name = "dev";
	let port = "0";
	let patch: string | undefined;
	for (let i = 0; i < tail.length; i++) {
		if (tail[i] === "--name") name = tail[++i] ?? "dev";
		else if (tail[i] === "--port") port = tail[++i] ?? "0";
		else if (tail[i] === "--patch") patch = resolve(tail[++i] ?? "");
		else flags.add(tail[i] as string);
	}
	return { command, name, flags, port, patch };
}

function paths(name: string) {
	const base = join(ROOT, name);
	const dshHome = join(base, "dshhome");
	mkdirSync(dshHome, { recursive: true });
	return { base, dshHome, log: join(base, "dsh.log"), state: join(base, "state.json") };
}

type Paths = ReturnType<typeof paths>;

function envOf(p: Paths): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && !key.startsWith("DSH_")) env[key] = value;
	}
	env.DSH_HOME = p.dshHome;
	env.DSH_AGENTS_HOME = join(p.base, "agents");
	env.DSH_TELEMETRY_MODE = "DISABLED";
	return env;
}

function clean(text: string): string {
	return text
		.split("\n")
		.filter((line) => !NOISE.test(line))
		.join("\n")
		.trim();
}

function run(argv: string[], p: Paths): void {
	const result = spawnSync(argv[0] as string, argv.slice(1), {
		cwd: p.base,
		env: envOf(p),
		encoding: "utf8",
	});
	const output = clean(`${result.stdout ?? ""}${result.stderr ?? ""}`);
	if (result.status !== 0) throw new Error(`${argv.join(" ")} failed:\n${output}`);
}

function readState(p: Paths): State | undefined {
	return existsSync(p.state) ? (JSON.parse(readFileSync(p.state, "utf8")) as State) : undefined;
}

function linked(p: Paths, profile: string, pkg: string): boolean {
	const manifest = join(p.dshHome, "profiles", profile, "package.json");
	if (!existsSync(manifest)) return false;
	const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
		dependencies?: Record<string, string>;
	};
	return parsed.dependencies?.[pkg] !== undefined;
}

function up(args: { name: string; flags: Set<string>; port: string; patch?: string }): void {
	const p = paths(args.name);
	const previous = readState(p);
	if (previous !== undefined) {
		try {
			process.kill(previous.pid, 0);
			console.log(`instance ${args.name} already runs at ${previous.url}`);
			return;
		} catch {
			// stale state from a stopped instance
		}
	}
	if (args.flags.has("--build")) {
		const build = spawnSync("bun", ["run", "build"], { cwd: REPO, encoding: "utf8" });
		if (build.status !== 0) throw new Error(`build failed:\n${build.stdout}${build.stderr}`);
	}
	if (!args.flags.has("--no-link")) {
		for (const [pkg, dir] of BUNDLES) {
			if (linked(p, "web", pkg)) continue;
			console.log(`linking ${pkg} into profile web`);
			run(["dsh", "plugin", "--profile", "web", "add", `link:${dir}`], p);
		}
	}
	writeFileSync(p.log, "");
	const out = openSync(p.log, "a");
	const child = spawn(
		"dsh",
		[
			"--profile",
			"web",
			...(args.patch === undefined ? [] : ["--patch", args.patch]),
			"--host",
			"127.0.0.1",
			"--port",
			args.port,
			"--no-open",
		],
		{ cwd: p.base, env: envOf(p), detached: true, stdio: ["ignore", out, out] },
	);
	child.unref();
	const pid = child.pid;
	if (pid === undefined) throw new Error("dsh did not start");
	const deadline = Date.now() + 90_000;
	let url: string | undefined;
	while (url === undefined && Date.now() < deadline) {
		const match = readFileSync(p.log, "utf8").match(/dsh web: (http:\/\/127\.0\.0\.1:(\d+)\/\?token=\S+)/);
		if (match !== null) url = match[1];
		else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
	}
	if (url === undefined) throw new Error(`no launch URL:\n${clean(readFileSync(p.log, "utf8"))}`);
	const port = Number(new URL(url).port);
	// Exchanging the token for a cookie lets curl and browsers keep using the bare origin.
	spawnSync("curl", ["-s", "-o", "/dev/null", "-c", join(p.base, "cookies.txt"), url]);
	const state: State = {
		name: args.name,
		pid,
		port,
		url,
		base: p.base,
		dshHome: p.dshHome,
		log: p.log,
		stop: `kill ${pid}`,
	};
	writeFileSync(p.state, `${JSON.stringify(state, null, "\t")}\n`);
	console.log(JSON.stringify(state, null, "\t"));
}

const parsed = argumentsOf(process.argv.slice(2));
try {
	if (parsed.command === "up") up(parsed);
	else if (parsed.command === "status") {
		const p = paths(parsed.name);
		console.log(JSON.stringify(readState(p) ?? null, null, "\t"));
	} else if (parsed.command === "down") {
		const p = paths(parsed.name);
		const state = readState(p);
		console.log(state === undefined ? "no instance" : `stop it with: ${state.stop}`);
	} else {
		console.log("usage: bun scripts/dev-instance.ts up|status|down [--name n] [--build] [--no-link]");
	}
} catch (error) {
	console.error(`dev-instance: ${(error as Error).message}`);
	process.exit(1);
}
