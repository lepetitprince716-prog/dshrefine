// Host half of @refine/refine.
//
// Two jobs:
//
// - Rewind: fork a Session at the event just before any user message. The Host already forks an
//   exact event prefix; this entry resolves "before message N" into that prefix and cancels a live
//   turn first, so the choice works while the agent is still answering.
// - Long commands: a prompt section that asks the agent to start anything slow as a background job
//   (`run_in_background`) instead of holding the turn. The capability is the shipped bash tool's;
//   the section is what makes it the default behaviour rather than an afterthought.
//
// Everything is declared locally: the bundle imports no @deepseek-ai package at runtime, so it
// loads in any profile that composes a web server and a session controller.

/** Services this entry needs before it activates. */
export const inject = ["webServer", "sessionController"];

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

interface HostContext {
	readonly webServer: {
		register(route: {
			readonly kind: "exact" | "prefix";
			readonly path: string;
			readonly handler: (req: HostRequest, res: HostResponse) => void | Promise<void>;
		}): () => void;
	};
	readonly sessionController: SessionControllerLike;
	inject(services: readonly string[], apply: (ctx: never) => void): void;
	effect(execute: () => (() => void) | void, label?: string): void;
	readonly logger?: { warn(...args: unknown[]): void };
}

/** The slice of the prompt service this entry uses. */
interface PromptHost {
	readonly systemPrompt: {
		section(section: {
			readonly name: string;
			readonly order: number;
			readonly text: string;
		}): () => void;
	};
	readonly jobs: unknown;
	effect(execute: () => (() => void) | void, label?: string): void;
}

interface Config {
	/** How long the Host waits for a cancelled turn to settle before attempting the fork again. */
	readonly settleTimeoutMs?: number;
}

const PREFIX = "/api/refine";
/** Header the browser must send; a cross-site form post cannot set it without a preflight. */
const HEADER = "x-refine";

/**
 * Guidance that turns the shipped background capability into the default for slow work. Short
 * commands stay foreground: their output is the answer, and a job round-trip only adds latency.
 */
const LONG_COMMAND_SECTION = `# Long-running commands

Start a command in the background when it is likely to run longer than ~10 seconds, or when it
serves instead of returning: installs, builds, full test suites, downloads, dev servers, watchers.
Call \`bash\` with \`run_in_background: true\` and keep working — read progress with \`job_output\`,
list with \`job_list\`, stop with \`job_kill\`. A foreground \`bash\` call holds the whole turn until
the command exits, so reserve it for quick checks and for anything whose exit code decides the
next step. When you do wait, pass a \`timeoutMs\` that matches how long the answer is worth
waiting for; the harness moves a command that outlives it to the background instead of blocking.`;

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
function cutsFor(events: readonly SessionEventLike[]): Map<number, number | undefined> {
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

	// Only a composition with a job runtime can background anything; without one the guidance
	// would describe tools that are not there.
	ctx.inject(["systemPrompt", "jobs"], (prompt: PromptHost) => {
		prompt.effect(
			() =>
				prompt.systemPrompt.section({
					name: "refine-long-commands",
					order: 1005,
					text: LONG_COMMAND_SECTION,
				}),
			"refine: long-command guidance",
		);
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
						const cuts = cutsFor(inspection.events);
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
}
