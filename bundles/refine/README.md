# @refine/refine

Rewind for DeepSeek Harness conversations, plus the guidance that keeps long commands off the turn.

## Rewind

- Client controls:
  - `conversation.session.header.utilities` — the main conversation header;
  - `dsh-split.pane.actions` — every split pane header, when the split bundle is loaded.
- The dialog reads `GET /api/refine/timeline?sessionId=…`, which walks the persisted session and
  returns up to 60 human messages with their event seq and the prefix to fork at. The prefix ends
  **before the turn that carried the message**, so the new conversation has no half-closed turn.
- Picking a message issues `POST /api/refine/rewind {sessionId, atSeq}`. The host cancels a live
  turn first, then calls the session controller's `fork({sessionId, atSeq})` and returns the new
  id. The client opens it; the original conversation is untouched.
- Both routes require the `x-refine: 1` header.

## Long commands

On load the host half registers one prompt section (`refine-long-commands`, order 1005) that asks
the agent to start anything slow with `bash`'s `run_in_background` and to keep working against
`job_output` / `job_list` / `job_kill` instead of holding the turn. It is registered only when the
composition has both `systemPrompt` and `jobs`, so a deployment without a job runtime never sees
guidance for tools that are absent.

There is no wrapper: the shipped bash tool already registers every command as a job and returns
the id at once for background calls. The section changes when the agent chooses that path.

## Install

```sh
bun build.ts
dsh plugin --profile <profile> add link:$PWD
```
