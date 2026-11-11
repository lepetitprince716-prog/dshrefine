// Host half of @refine/split.
//
// The split itself is browser-only, but a pane's home surface has to list the agent modes the Host
// composes. That roster lives behind the Host's agent-preset registry, so this entry serves one
// small read-only route and leaves the browser free of Host service plumbing.
//
// The route is read-only and same-origin guarded by a header the browser sets; without the registry
// (a profile that composes no presets) it answers an empty roster and the surface starts with the
// deployment default.

/** Services this entry needs. `agentPresetRegistry` is optional at runtime. */
export const inject = ["webServer"];

interface HostRequest {
	readonly method?: string;
	readonly url?: string;
	readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

interface HostResponse {
	statusCode: number;
	setHeader(name: string, value: string): void;
	end(body?: string): void;
}

interface PresetRow {
	readonly id: string;
	readonly name?: string;
	readonly description?: string;
	readonly isDefault?: boolean;
	readonly broken?: string;
}

interface PresetRegistry {
	remoteExportList(): Promise<{ readonly presets: readonly PresetRow[] }>;
}

interface HostContext {
	readonly webServer: {
		register(route: {
			readonly kind: "exact";
			readonly path: string;
			readonly handler: (req: HostRequest, res: HostResponse) => void | Promise<void>;
		}): () => void;
	};
	readonly agentPresets: PresetRegistry;
	inject(services: readonly string[], apply: (ctx: HostContext) => void): void;
	effect(execute: () => (() => void) | void, label?: string): void;
	logger?: { warn(...args: unknown[]): void };
}

export function apply(ctx: HostContext): void {
	// Without a preset registry there is nothing to list; the surface then starts with the
	// deployment default and the route simply does not exist.
	ctx.inject(["agentPresets"], (child) => {
		child.effect(
			() =>
				child.webServer.register({
				kind: "exact",
				path: "/api/split/presets",
				handler: async (req, res) => {
					res.setHeader("content-type", "application/json; charset=utf-8");
					res.setHeader("cache-control", "no-store");
					if (req.method !== "GET") {
						res.statusCode = 405;
						res.end(JSON.stringify({ error: "method not allowed" }));
						return;
					}
					// A cross-site page cannot set a custom header without a preflight, which this
					// route never grants.
					if (req.headers["x-split"] === undefined) {
						res.statusCode = 403;
						res.end(JSON.stringify({ error: "forbidden" }));
						return;
					}
					try {
						const roster = await child.agentPresets.remoteExportList();
						res.statusCode = 200;
						res.end(
							JSON.stringify({
								presets: (roster?.presets ?? []).map((preset) => ({
									id: preset.id,
									name: preset.name,
									description: preset.description,
									isDefault: preset.isDefault === true,
									broken: preset.broken,
								})),
							}),
						);
					} catch (cause) {
						child.logger?.warn("[dsh-split] preset roster failed", cause);
						res.statusCode = 500;
						res.end(JSON.stringify({ error: String(cause) }));
					}
				},
			}),
			"dsh-split: preset route",
		);
	});
}
