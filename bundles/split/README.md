# @refine/split

Split-screen sessions for DeepSeek Harness. Client-only; the host half serves one read-only route
for the agent-mode roster.

## How it works

- Opening a split registers a `main.conversation` shadow at priority -1 that renders only an
  anchor box. A root `shell.overlay` entry measures that box and renders every pane over it, flat
  and in stable DOM order, so splitting, closing a sibling or dragging a divider never remounts a
  pane.
- Each pane retains its Session in an effect (source `dshSplit`), wraps it in `SessionProvider`
  and renders the `conversation.content` factory with `variant: "embedded"` and `hero: false`
  through the session-scoped child slot `dsh-split.pane`.
- An empty pane renders its **home surface**: the Workspace list, a folder path for a new
  Workspace, the agent-mode chips from `/api/split/presets`, and a link to the session picker.
  Starting there creates the Session with the chosen Workspace and `agentPreset`.
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

## Host route

`GET /api/split/presets` returns `{presets:[{id,name,description,isDefault,broken}]}` from
`agentPresets.remoteExportList()`. It requires the `x-split: 1` header. When the profile composes
no agent-preset registry the route is not registered and the home surface shows no mode row.

## Install

```sh
bun build.ts
dsh plugin --profile <profile> add link:$PWD
```

## Attribution

`src/layout/tree.ts` and `src/client/focus.ts` adapt MIT code from rainfd/dsh-split-pane; layout
fitting follows herdr (Apache-2.0, rewritten). See `NOTICE` at the repository root.
