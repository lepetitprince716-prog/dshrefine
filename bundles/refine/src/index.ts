// Host half of @refine/refine.
//
// Two capabilities the shipped composition does not expose to a browser:
//
// - Rewind: fork a Session at the event just before any user message. The Host already forks an
//   exact event prefix; this entry resolves "before message N" into that prefix and cancels a live
//   turn first, so the choice works while the agent is still answering.
// - Background: a `bash` call keeps running after the browser asks for it. Each Agent's resolved
//   `bash` definition is wrapped one scope deeper and its wait is raced against a per-call release;
//   releasing returns a synthetic result that points the agent at `job_list`, while the command
//   continues as the job the bash tool registered when it started.
//
// Everything is declared locally: the bundle imports no @deepseek-ai package at runtime, so it
// loads in any profile that composes a web server and a session controller.

/** Services this entry needs before it activates. */
export const inject = ["webServer", "sessionController", "tools"];

interface HostRequest {
	readonly method?: string;
	readonly url?: string;
	readonly headers: Readonly<Record<string, string | string[] | undefined>>;
	on(event: "data", listener: (chunk: unknown) => void): void;
	on(event: "end", listener: () => void): void;
	on(event: "error", listener: (error: unknown) => void): void;
}

interface HostResponse {
	statusCode: number;
	setHeader(name: string, value: string): void;
	end(body?: string): void;
}

interface SessionEventLike {
	readonly type: string;
	readonly seq: number;
	readonly time?: number;
	readonly data?: {
		readonly content?: readonly { readonly type?: string; readonly text?: string }[];
		readonly source?: { readonly kind?: string };
	};
}

interface SessionControllerLike {
	inspect(sessionId: string): Promise<{ readonly events: readonly SessionEventLike[] }>;
	cancel(request: { readonly sessionId: string }): unknown;
	fork(request: { readonly sessionId: string; readonly atSeq?: number }): Promise<{
		readonly sessionId: string;
	}>;
}

interface ToolDefinitionLike {
	readonly name: string;
	execute(args: unknown, exec: unknown): Promise<unknown>;
	readonly [key: string]: unknown;
}

interface AgentLike {
	readonly id: string;
	readonly ctx: {
		readonly tools: { register(definition: ToolDefinitionLike): unknown };
	};
	readonly session?: { readonly header?: { readonly cwd?: string } };
}

interface HostContext {
	readonly webServer: {
		register(route: {
			readonly kind: "exact" | "prefix";
			readonly path: string;
			readonly handler: (req: HostRequest, res: HostResponse) => void | Promise<void>;
		}): () => void;
	};
	readonly sessionController: SessionControllerLike;
	readonly tools: {
		get(name: string, scope?: AgentLike): ToolDefinitionLike | undefined;
	};
	on(
		event: "agent/created",
		listener: (payload: { readonly agent: AgentLike }) => void,
	): () => void;
	effect(execute: () => (() => void) | void, label?: string): void;
	readonly logger?: { warn(...args: unknown[]): void };
}

interface Config {
	/** How long the Host waits for a cancelled turn to settle before attempting the fork again. */
	readonly settleTimeoutMs?: number;
}

const PREFIX = "/api/refine";
/** Header the browser must send; a cross-site form post cannot set it without a preflight. */
const HEADER = "x-refine";

function send(res: HostResponse, status: number, body: unknown): void {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(body));
}

async function readJson(req: HostRequest): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	await new Promise<void>((resolve, reject) => {
		req.on("data", (chunk) => chunks.push(Buffer.from(chunk as Uint8Array)));
		req.on("end", () => resolve());
		req.on("error", reject);
	});
	const raw = Buffer.concat(chunks).toString("utf8");
	if (raw.trim() === "") return {};
	return JSON.parse(raw) as Record<string, unknown>;
}

/** The human-visible text of one model-facing message. */
function messageText(blocks: readonly { readonly type?: string; readonly text?: string }[]): string {
	return blocks
		.map((block) => {
			if (block.type === "text") return block.text ?? "";
			if (block.type === "image") return "[image]";
			return "";
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The prefix a fork must keep to drop a message and its whole turn. Cutting at the event just
 * before the message would keep the turn's opening record, which the Host then closes with a
 * synthetic closer and the new conversation starts with a dangling "completed" marker.
 */
function traceAtSeqs(events: readonly SessionEventLike[]): Map<number, number | undefined> {
	const cut = new Map<number, number | undefined>();
	let turnStart: number | undefined;
	for (const event of events) {
		if (event.type === "turn/start") turnStart = event.seq;
		if (event.type !== "user/message" || event.data?.source?.kind !== "user") continue;
		cut.set(event.seq, turnStart !== undefined && turnStart > 0 ? turnStart - 1 : undefined);
	}
	return cut;
}

function authorized(req: HostRequest): boolean {
	const header = req.headers[HEADER];
	return header === "1" || header === "true";
}

export function apply(ctx: HostContext, config: Config = {}): void {
	const settleMs = config.settleTimeoutMs ?? 2_000;

	/** Live `bash` calls per Session, each with the release the browser route fires. */
	const live = new Map<string, Set<() => void>>();

	const track = (sessionId: string, release: () => void): (() => void) => {
		let set = live.get(sessionId);
		if (set === undefined) {
			set = new Set();
			live.set(sessionId, set);
		}
		set.add(release);
		const owner = set;
		return () => {
			owner.delete(release);
			if (owner.size === 0 && live.get(sessionId) === owner) live.delete(sessionId);
		};
	};

	/**
	 * Wrap the agent's own `bash` definition so a browser request can release a call early.
	 *
	 * The definition is resolved through the registry per agent, then re-registered one layer
	 * deeper (agent scope), which the registry resolves before the global row. Everything but
	 * `execute` is carried over unchanged, so schema, presentation, budgets and sandbox behaviour
	 * stay exactly those of the shipped tool; only the wait is raced.
	 */
	const installGate = (agent: AgentLike): void => {
		const base = ctx.tools.get("bash", agent);
		if (base === undefined) return;
		const wrapped: ToolDefinitionLike = {
			...base,
			execute: async (args: unknown, exec: unknown) => {
				let fire: (() => void) | undefined;
				const gate = new Promise<void>((resolve) => {
					fire = resolve;
				});
				const untrack = track(agent.id, () => fire?.());
				const running = base.execute(args, exec);
				// The command keeps running; its settlement belongs to the job registry.
				running.catch(() => undefined);
				try {
					const winner = await Promise.race([
						running.then((value) => ({ detached: false as const, value })),
						gate.then(() => ({ detached: true as const })),
					]);
					if (!winner.detached) return winner.value;
					return detachedValue(agent);
				} finally {
					untrack();
				}
			},
		};
		try {
			agent.ctx.tools.register(wrapped);
		} catch (cause) {
			ctx.logger?.warn("[refine] bash gate not installed", cause);
		}
	};

	/** A foreground-shaped result that tells the model where the command went. */
	const detachedValue = (agent: AgentLike): unknown => ({
		kind: "foreground",
		cwd: agent.session?.header?.cwd ?? ".",
		exitCode: null,
		signal: null,
		timedOut: false,
		aborted: false,
		timeoutMs: 0,
		stdout: {
			text: "[moved to the background]\nThe command is still running as a background job. Use job_list to find it and job_output to read its output; do not start it again.",
			truncated: false,
		},
		stderr: { text: "", truncated: false },
	});

	ctx.on("agent/created", (payload) => {
		installGate(payload.agent);
	});

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "exact",
				path: `${PREFIX}/timeline`,
				handler: async (req, res) => {
					if (!authorized(req)) return send(res, 403, { error: "forbidden" });
					const sessionId = new URL(req.url ?? "", "http://localhost").searchParams.get(
						"sessionId",
					);
					if (sessionId === null || sessionId === "")
						return send(res, 400, { error: "sessionId is required" });
					try {
						const inspection = await ctx.sessionController.inspect(sessionId);
						const cuts = traceAtSeqs(inspection.events);
						const messages = inspection.events
							.filter(
								(event) =>
									event.type === "user/message" && event.data?.source?.kind === "user",
							)
							.map((event) => ({
								seq: event.seq,
								time: event.time ?? 0,
								text: messageText(event.data?.content ?? []).slice(0, 280),
								atSeq: cuts.get(event.seq),
							}))
							.filter((entry) => entry.atSeq !== undefined)
							.slice(-60)
							.reverse();
						return send(res, 200, { sessionId, messages });
					} catch (cause) {
						ctx.logger?.warn("[refine] timeline failed", cause);
						return send(res, 500, { error: String(cause) });
					}
				},
			}),
		"refine: timeline route",
	);

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "exact",
				path: `${PREFIX}/rewind`,
				handler: async (req, res) => {
					if (!authorized(req) || req.method !== "POST")
						return send(res, 403, { error: "forbidden" });
					let body: Record<string, unknown>;
					try {
						body = await readJson(req);
					} catch {
						return send(res, 400, { error: "invalid JSON" });
					}
					const sessionId = body.sessionId;
					const atSeq = body.atSeq;
					if (typeof sessionId !== "string" || sessionId === "")
						return send(res, 400, { error: "sessionId is required" });
					if (typeof atSeq !== "number" || !Number.isInteger(atSeq) || atSeq < 0)
						return send(res, 400, { error: "atSeq must be a non-negative integer" });
					// A live turn holds the prefix open; stop it first and give it a moment to settle.
					try {
						ctx.sessionController.cancel({ sessionId });
					} catch {
						// An idle Session has nothing to cancel.
					}
					const deadline = Date.now() + settleMs;
					for (;;) {
						try {
							const forked = await ctx.sessionController.fork({ sessionId, atSeq });
							return send(res, 200, { sessionId: forked.sessionId });
						} catch (cause) {
							if (Date.now() >= deadline) {
								ctx.logger?.warn("[refine] rewind failed", cause);
								return send(res, 409, { error: String(cause) });
							}
							await new Promise((resolve) => setTimeout(resolve, 200));
						}
					}
				},
			}),
		"refine: rewind route",
	);

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "exact",
				path: `${PREFIX}/detach`,
				handler: async (req, res) => {
					if (!authorized(req) || req.method !== "POST")
						return send(res, 403, { error: "forbidden" });
					let body: Record<string, unknown>;
					try {
						body = await readJson(req);
					} catch {
						return send(res, 400, { error: "invalid JSON" });
					}
					const sessionId = body.sessionId;
					if (typeof sessionId !== "string" || sessionId === "")
						return send(res, 400, { error: "sessionId is required" });
					const calls = live.get(sessionId);
					if (calls === undefined || calls.size === 0)
						return send(res, 200, { detached: 0 });
					const releases = [...calls];
					for (const release of releases) release();
					return send(res, 200, { detached: releases.length });
				},
			}),
		"refine: detach route",
	);
}
