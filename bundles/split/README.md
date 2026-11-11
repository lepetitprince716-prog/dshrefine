# @refine/split

Split-screen sessions for DeepSeek Harness. Client-only: the host row is an empty entry that keeps
the bundle composable, and every surface is the host's own.

## How it works

- Opening a split registers a `main.conversation` shadow at priority -1 that renders only an
  anchor box. A root `shell.overlay` entry measures that box and renders every pane over it, flat
  and in stable DOM order, so splitting, closing a sibling or dragging a divider never remounts a
  pane.
- Each pane retains its Session in an effect (source `dshSplit`), wraps it in `SessionProvider`
  and renders the `conversation.content` factory with `variant: "embedded"` through the
  session-scoped child slot `dsh-split.pane`.
- A blank Session renders with `hero: true`, so a new pane shows the **host's own new-session
  surface inside the pane**: the Workspace chip (with the host's workspace menu and its Add
  workspace / folder chooser), the agent-mode chip, and the host's composer. Sending the first
  message starts the conversation exactly as in the main view. The pane `+` button, the split
  buttons and a new-conversation drop all start a blank Session in the project of the pane they
  split from; the chips change it from there.
- The workspace and mode chips act through the host's main selection; the controller follows that
  selection into the focused pane, which is the pane the user clicked to reach the chip.
- An empty pane (a Session missing from the list, or a split opened from a sidebar drag) shows the
  session picker: pick an existing conversation or start a new one in the same directory, which
  then shows the new-session surface above.
- The layout is a binary tree (at most 8 panes, ratios 0.1-0.9). Panes tile with no gap; a
  hairline divider is the only separation. Closing the focused pane returns focus to the previous
  one; closing the second-to-last pane leaves split mode.
- Each pane header carries the pane title, status dot, and a `dsh-split.pane.actions` list slot
  that other bundles (the rewind control) fill.
- Sizing keeps cards at least 280 x 200 px: when a new or moved pane would leave a card smaller,
  dividers move just enough. When no divider positions fit, one pane is shown behind a strip of
  pills.
- The active pane keeps the keyboard. The layout persists in `localStorage` key `dsh-split.layout`
  (version 1), validated on read.

## Memory and power

- A pane that stays unfocused for 20 minutes and is not working releases its retain and unmounts
  the conversation tree; waking it rebuilds from the session log.
- `html[data-rf-background]` pauses decorative animations while the window is hidden.
- `localStorage["dsh-split.quiet"] = "1"` adds `html.rf-quiet`, which pauses them in the foreground
  as well.

## Install

```sh
bun build.ts
dsh plugin --profile <profile> add link:$PWD
```

## Attribution

`src/layout/tree.ts` and `src/client/focus.ts` adapt MIT code from rainfd/dsh-split-pane; layout
fitting follows herdr (Apache-2.0, rewritten). See `NOTICE` at the repository root.
