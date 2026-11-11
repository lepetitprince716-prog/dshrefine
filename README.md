# dshrefine

Two DeepSeek Harness UI bundles that make daily conversations easier to work in: **split view**
with a real new-conversation surface, and **rewind** — go back to any earlier message and continue
from there.

Built against DeepSeek Harness **0.2.1-rc.1** (web) and run on **0.2.1-rc.2** (desktop). Both
bundles are browser-only except for three small read/write routes; no host package is forked or
patched.

| Bundle | What it does |
| --- | --- |
| [`@refine/split`](bundles/split) | Several conversations side by side. A new pane asks for its project and mode instead of inheriting the main view's selection. Flat panes, no cards, no focus rings. |
| [`@refine/refine`](bundles/refine) | A rewind control in every conversation header and in every split pane: pick an earlier message, get a fresh conversation from just before it, while this one stays intact. |

The interaction patterns are borrowed from desktop tools that do this well — VS Code's editor
grid for panes, and the "continue from here" model of conversation history that coding agents have
popularised. Nothing is copied from a closed product.

## Features

### Split view

- Up to 8 panes in a binary tree, drag a session row or a pane header to place it, dividers with
  keyboard support, one-pane-at-a-time fallback on narrow surfaces.
- **Every new conversation in a pane starts on a home surface**: the project list, a folder path
  for a new project, a folder chooser (the desktop window's own native dialog, else the
  deployment's directory picker), and the agent modes the deployment composes (standard, minimal,
  creator, PTC — whatever the roster reports). Start there and the conversation is created in
  that project with that mode. The pane `+` button, a new-conversation drop, the split buttons
  and, while a split is open, the sidebar's New session button all land here, so nothing is
  silently created in the main view's project any more.
- Jump to an existing conversation from the same surface; its "new" action returns to the home
  surface rather than creating a Session in an inherited directory.
- **Flat panes**: no card, no shadow, no accent ring. Panes tile edge to edge and a hairline
  divider separates them; the active pane is marked by its header, not by a frame around the
  conversation.
- Layout persists in `localStorage` (`dsh-split.layout`), validated on read.
- Memory and power:
  - a pane that has not been focused for 20 minutes and is not working releases its Session and
    conversation tree, and restores it from the log when you wake it;
  - decorative motion pauses while the window is in the background;
  - `localStorage["dsh-split.quiet"] = "1"` pauses it in the foreground too (long battery runs).

### Rewind

- A rewind button in the conversation header and in each split pane header.
- Lists the human messages of the conversation (time and text), newest first.
- Picking one stops a live turn, then forks the conversation at the event just before that
  message's turn: the new conversation is clean, with no dangling "completed" marker, and the
  original is untouched.
- Works while the agent is still answering: the turn is cancelled first, then the fork is created.
- The rewind control is localised (English / 简体中文).

### Long commands

A conversation should not sit and watch a build. The bundle adds one prompt section: anything
expected to run longer than ~10 seconds — installs, builds, test suites, downloads, servers — is
started with `bash`'s `run_in_background: true`, and the agent keeps working while the command
runs as a job. Progress comes from `job_output`, the roster from `job_list`, and `job_kill` stops
it. The turn ends as soon as the command is admitted instead of when it exits.

The capability is the shipped bash tool's; the section is what makes it the default behaviour.
Nothing is wrapped, patched, or re-implemented.

[`extras/fast-background.patch.yml`](extras/fast-background.patch.yml) is a second line of defence
for deployments that want a hard budget: it lowers the executor's foreground wait so the tool
moves a command to the background on its own. The section above is the part this repository ships
by default.

A manual "move the running command to the background" control is not possible on 0.2.1: a profile
bundle cannot intercept a model-direct tool call (neither the `tools/execute` waterfall nor an
agent-scope tool wrapper reaches it). The bundle does not ship a button that cannot work.

## Install

The bundles are consumed as local packages of a dsh profile. Build first:

```sh
bun install
bun run build
```

Then link the bundle you want into a profile and restart that profile:

```sh
dsh plugin --profile <profile> add link:$PWD/bundles/split
dsh plugin --profile <profile> add link:$PWD/bundles/refine
```

The desktop app manages its own profile: add the two directories through its plugin manager
(local directory), then reload the window.

## Development

```sh
bun run typecheck   # tsc for the kit and both bundles
bun test            # unit tests (layout tree, geometry, storage, drop planning, UI kit)
bun run build       # dist/index.js and dist/client.js for both bundles
bun scripts/dev-instance.ts up --build   # throwaway dsh web on a free port under /private/tmp
bun scripts/dev-instance.ts down
```

`scripts/dev-instance.ts` creates an isolated `DSH_HOME`, links both bundles into a fresh `web`
profile, starts `dsh web` on port 0 and prints the URL. It accepts `--port <n>` (keep the origin
for `localStorage` state) and `--patch <file>` (extra profile patch, for example a fake model).

## Layout

```
packages/ui            @refine/ui — the component kit (buttons, overlays, diff view, tokens)
bundles/split          @refine/split — pane tree, drag/drop, home surface, flat styles
bundles/refine         @refine/refine — rewind (host route + dialog), long-command guidance for background jobs
extras/               optional profile patches
scripts/               dev instance helper
```

## Known limits

- Rewinding creates a **new conversation** (the host's fork API); the original is kept. There is no
  in-place truncation of a session log.
- The home surface reads the mode roster through a small host route (`/api/split/presets`). A
  profile without the agent-preset registry still works: the mode row is simply not shown.
- The three plugin routes are guarded by a custom header (no cross-site form can set it), but the
  harness web server has no per-route authentication; they exist on the loopback interface only.
- Split panes keep the host conversation without its header; each pane gets its own header with
  the session breadcrumb, status dot, and the rewind control.

## License

MIT. Third-party attribution is in [`NOTICE`](NOTICE).
