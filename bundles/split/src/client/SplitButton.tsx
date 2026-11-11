// The "Split view" control in the main conversation header (`conversation.session.header.utilities`).
// A click opens a picker pane on the right; dragging it places an empty pane wherever it is dropped.
// Its tooltip opens in the bundle's overlay store, whose layer the always-mounted overlay entry
// renders.
import { IconButton, OverlayProvider, type OverlayStore, Tooltip } from "@refine/ui";
import type { DragEvent, ReactNode } from "react";
import type { SplitController } from "./controller.ts";
import { type DragStore, startOwnDrag } from "./drag.ts";
import { HeaderSplitGlyph } from "./glyphs.tsx";
import type { Translate } from "./locale.ts";

export interface SplitButtonProps {
	readonly controller: SplitController;
	readonly drag: DragStore;
	readonly overlay: OverlayStore;
	readonly t: Translate;
}

export function SplitButton({ controller, drag, overlay, t }: SplitButtonProps): ReactNode {
	const label = t("header.split");
	return (
		<OverlayProvider store={overlay}>
			<span className="rf-root dsp-split-button">
				<Tooltip label={label} placement="bottom-end">
					<IconButton
						size="sm"
						label={label}
						icon={<HeaderSplitGlyph />}
						draggable
						onClick={() => controller.splitActive("row")}
						onDragStart={(event: DragEvent<HTMLButtonElement>) =>
							startOwnDrag(event.dataTransfer, drag, { kind: "empty" }, t("ghost.empty"))
						}
					/>
				</Tooltip>
			</span>
		</OverlayProvider>
	);
}
