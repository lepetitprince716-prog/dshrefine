// The browser side of the bundle's two Host routes. Every call carries the guard header the Host
// requires, so a cross-site page cannot trigger a rewind or a detach with a plain form post.
const HEADER = "x-refine";

async function call<T>(path: string, init: RequestInit): Promise<T> {
	const response = await fetch(path, {
		...init,
		credentials: "same-origin",
		headers: {
			accept: "application/json",
			[HEADER]: "1",
			...(init.headers ?? {}),
		},
	});
	const text = await response.text();
	const parsed: unknown = text === "" ? undefined : JSON.parse(text);
	if (!response.ok) {
		const message =
			typeof parsed === "object" && parsed !== null && "error" in parsed
				? String((parsed as { error: unknown }).error)
				: `HTTP ${response.status}`;
		throw new Error(message);
	}
	return parsed as T;
}

export interface TimelineEntry {
	readonly seq: number;
	readonly time: number;
	readonly text: string;
	readonly atSeq: number;
}

export function readTimeline(sessionId: string): Promise<{ messages: TimelineEntry[] }> {
	return call(`/api/refine/timeline?sessionId=${encodeURIComponent(sessionId)}`, { method: "GET" });
}

export function rewind(sessionId: string, atSeq: number): Promise<{ sessionId: string }> {
	return call("/api/refine/rewind", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ sessionId, atSeq }),
	});
}

export function detach(sessionId: string): Promise<{ detached: number }> {
	return call("/api/refine/detach", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ sessionId }),
	});
}
