import type { ClientContext } from "../dsh-types.d.ts";

/** Client locale namespace of the bundle. */
export const NS = "refine";

/** Chinese is the key-set source of truth; English carries the same keys. */
const zh = {
	"header.rewind": "回退到之前的消息",
	"header.background": "把正在跑的命令转到后台",
	"rewind.title": "回退到某条消息之前",
	"rewind.hint": "会新建一个对话，从选中的消息之前继续；原对话保留，不会丢。",
	"rewind.running": "当前回答会先停住，再创建新对话。",
	"rewind.loading": "正在读取对话…",
	"rewind.empty": "还没有可以回退的消息。",
	"rewind.failed": "读取失败：{message}",
	"rewind.pick": "从这里重新开始",
	"rewind.busy": "正在创建…",
	"rewind.close": "关闭",
	"rewind.older": "更早的消息",
	"background.done": "已转到后台",
	"background.none": "现在没有正在跑的命令",
	"background.failed": "转到后台失败：{message}",
} as const;

const en: Record<keyof typeof zh, string> = {
	"header.rewind": "Rewind to an earlier message",
	"header.background": "Move the running command to the background",
	"rewind.title": "Rewind to before a message",
	"rewind.hint":
		"A new conversation continues from before the chosen message; this one stays intact.",
	"rewind.running": "The current answer stops first, then the new conversation is created.",
	"rewind.loading": "Reading the conversation…",
	"rewind.empty": "No earlier message to rewind to yet.",
	"rewind.failed": "Could not read the conversation: {message}",
	"rewind.pick": "Continue from here",
	"rewind.busy": "Creating…",
	"rewind.close": "Close",
	"rewind.older": "Older messages",
	"background.done": "Moved to the background",
	"background.none": "No command is running right now",
	"background.failed": "Could not move it to the background: {message}",
};

export type Translate = (key: keyof typeof zh, params?: Record<string, string | number>) => string;

export function registerLocale(ctx: ClientContext): () => void {
	return ctx.locale.register(NS, { zh, en } as { zh: Record<string, string>; en: Record<string, string> });
}
