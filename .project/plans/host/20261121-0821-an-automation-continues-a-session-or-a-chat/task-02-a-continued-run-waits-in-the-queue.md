---
title: A continued run waits in the queue
status: todo
depends: [01]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/automations.ts#L615-L644](../../../../packages/sdk/src/host/automations.ts#L615-L644) - `request` and its overlap rules"
  - "[code://packages/sdk/src/host/queuedrain.ts#L237-L242](../../../../packages/sdk/src/host/queuedrain.ts#L237-L242) - `enqueue`"
---

## Objective

A `previousSession` run puts its message in the previous session's queue, as AHP says. It never steers, and it starts a new session when the previous one is unusable.

## Files

- `UPDATE: packages/sdk/src/host/automations.ts:615-644` - a continued target skips `overlap` and queues; `overlap` stays for new-session runs.
- `UPDATE: packages/sdk/src/host/automations.ts:471-475` - the previous session is checked usable: present, not archived, with a default chat, made from the same template.
- `CREATE: packages/sdk/test/automation-previous-session.test.ts` - the queue, the lifecycle and the fallback.

## Steps

1. Read VS Code's `_queueInPreviousSession` at L1322-L1366, and record its rules in Resume.
2. Link the session to the run with `automationRun/sessionSet` and make it primary, before `enqueue`.
3. Queue the message on the session's default chat with `enqueue`, with the template's `model` and `agent`.
4. Keep the run `pending` while its message waits, and set it `running` from the turn that takes it.
5. Cancel the run when a person withdraws its message.
6. Remove the message when a person cancels the run.
7. Start a new session when the previous one is unusable, and continue that one from then on.

## Validation

- `packages/sdk/test/automation-previous-session.test.ts` - a run during a turn queues and waits.
- The same file - it never steers with `overlap: steer`.
- The same file - a gone session starts a new one, and a cancel removes the message.
- The sdk vitest suite passes.

## Resume
