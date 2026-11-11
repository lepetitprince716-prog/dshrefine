// Keyboard commands. Default chords are offered for the current runtime profile only, and only
// when the host reports no conflict: overlapping defaults throw at registration, and other
// plugins (or a later dsh release) may already own a chord. A dropped default leaves the command
// unbound but listed in the shortcut reference, where the user can bind it.
import type { ClientShortcuts, ShortcutBinding } from "../dsh-types.d.ts";
import type { SplitController } from "./controller.ts";
import type { MessageKey, Translate } from "./locale.ts";

interface CommandSpec {
	readonly id: string;
	readonly label: MessageKey;
	readonly aliases: readonly string[];
	readonly binding: ShortcutBinding;
	/** Whether the command applies now; otherwise the keystroke passes through. */
	readonly applies: (controller: SplitController) => boolean;
	readonly run: (controller: SplitController) => void;
}

const always = (): boolean => true;
const whileSplit = (controller: SplitController): boolean => controller.getSnapshot() !== null;

const COMMANDS: readonly CommandSpec[] = [
	{
		id: "dsh-split.split-right",
		label: "shortcut.splitRight",
		aliases: ["split", "side by side"],
		binding: { code: "Backslash", modifiers: ["primary", "alt"] },
		applies: always,
		run: (controller) => controller.splitActive("row"),
	},
	{
		id: "dsh-split.split-down",
		label: "shortcut.splitDown",
		aliases: ["split", "stack"],
		binding: { code: "Minus", modifiers: ["primary", "alt"] },
		applies: always,
		run: (controller) => controller.splitActive("column"),
	},
	{
		id: "dsh-split.close-pane",
		label: "shortcut.close",
		aliases: ["split", "close pane"],
		binding: { code: "KeyW", modifiers: ["primary", "alt"] },
		applies: whileSplit,
		run: (controller) => {
			const state = controller.getSnapshot();
			if (state !== null) controller.closePane(state.focus);
		},
	},
	{
		id: "dsh-split.next-pane",
		label: "shortcut.next",
		aliases: ["split", "pane"],
		binding: { code: "BracketRight", modifiers: ["primary", "alt"] },
		applies: whileSplit,
		run: (controller) => controller.focusStep(1),
	},
	{
		id: "dsh-split.previous-pane",
		label: "shortcut.previous",
		aliases: ["split", "pane"],
		binding: { code: "BracketLeft", modifiers: ["primary", "alt"] },
		applies: whileSplit,
		run: (controller) => controller.focusStep(-1),
	},
	{
		id: "dsh-split.zoom-pane",
		label: "shortcut.zoom",
		aliases: ["split", "maximize", "zoom"],
		binding: { code: "Enter", modifiers: ["primary", "alt"] },
		applies: whileSplit,
		run: (controller) => controller.toggleZoom(),
	},
	{
		id: "dsh-split.new-beside",
		label: "shortcut.newBeside",
		aliases: ["split", "new conversation"],
		binding: { code: "KeyN", modifiers: ["primary", "alt"] },
		applies: always,
		run: (controller) => controller.newBeside(undefined),
	},
];

export function registerShortcuts(
	shortcuts: ClientShortcuts,
	controller: SplitController,
	t: Translate,
): () => void {
	const profile = `${shortcuts.runtime}:${shortcuts.platform}`;
	const disposers = COMMANDS.map((command) => {
		const free = shortcuts.describeBinding(command.binding).conflicts.length === 0;
		return shortcuts.register({
			id: command.id,
			label: () => t(command.label),
			aliases: command.aliases,
			defaults: free ? { [profile]: command.binding } : {},
			regions: ["page", "editable"],
			modals: [],
			resolve: () =>
				command.applies(controller)
					? { status: "handled", run: () => command.run(controller) }
					: { status: "pass" },
		});
	});
	return () => {
		for (const dispose of disposers) dispose();
	};
}
