# @refine/refine

Rewind for DeepSeek Harness conversations, plus a preview of background detach.

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

## Background (preview)

`POST /api/refine/detach {sessionId}` releases the registered `bash` calls of that Session. The
host half wraps each Agent's resolved `bash` definition one scope deeper and races the wait
against that release; releasing returns a foreground-shaped `[moved to the background]` value and
the command keeps running as its job.

On 0.2.1-rc.1 the hook does not bite: a profile bundle's `tools/execute` listener is never
invoked, and the agent-scope wrapper resolves through `ctx.tools.get("bash", agent)` yet is not the
definition a model-direct call executes. The control in the header is hidden unless
`localStorage["refine.detach"] = "1"`. The reliable path today is the executor's own
promote-on-timeout budget — see `extras/fast-background.patch.yml` at the repository root.

## Install

```sh
bun build.ts
dsh plugin --profile <profile> add link:$PWD
```
