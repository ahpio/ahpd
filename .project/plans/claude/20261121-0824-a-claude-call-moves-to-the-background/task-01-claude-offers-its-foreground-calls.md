---
title: Claude offers its foreground Bash and subagent calls
status: todo
depends: []
layer: "agent-claude"
refs:
  - "[code://packages/agent-claude/src/session/query.ts#L1215-L1248](../../../../packages/agent-claude/src/session/query.ts#L1215-L1248) - where `task_started` and `task_updated` are read"
  - "[code://packages/agent-claude/src/session/workers.ts#L400-L420](../../../../packages/agent-claude/src/session/workers.ts#L400-L420) - `stopOf`, the pattern for a call through `ctx.query`"
  - "[code://packages/agent-claude/test/agent-claude-background-work.test.ts](../../../../packages/agent-claude/test/agent-claude-background-work.test.ts) - the tests of the rows, which the new cases join"
---

## Objective

A Claude Bash or subagent call that runs in the foreground is offered through `Start.movableCalls`.
Its move calls `query.backgroundTasks(toolUseId)` and answers the row id.

## Files

- `UPDATE: packages/agent-claude/src/session/workers.ts` - add `moveOf(toolUseId, taskId, kind)`, beside `stopOf`.
- `UPDATE: packages/agent-claude/src/session/query.ts:1215-1248` - offer on `task_started` with `is_backgrounded: false`; withdraw on `task_updated` with `is_backgrounded: true`, on the call's `tool_result`, and on the terminal `task_notification`.
- `UPDATE: packages/agent-claude/test/agent-claude-background-work.test.ts` - the offer, the move, the withdraw.
- `UPDATE: packages/agent-claude/README.md:209` - a foreground Bash or subagent call can move to the background through `x-ahpd/backgroundToolCall`.

## Steps

1. Check that the ahpd tool call id of a Claude call is the SDK's tool_use id.
2. Map the id where it is not.
3. Add `moveOf`, which calls `ctx.query.backgroundTasks(toolUseId)` and answers `shell:<task id>` or `subagent:<task id>`, or `undefined` on `false` or a throw.
4. On `task_started` with `is_backgrounded: false` and a `task_type` of `local_bash` or `local_agent`, offer the call on `info.chat` through `ctx.options.movableCalls`.
5. Skip the offer when the session's environment sets `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`.
6. Withdraw the offer on the call's `tool_result`, on `task_updated` with `is_backgrounded: true`, and on the terminal `task_notification`.
7. Add the README sentence.
8. Write the tests with the fake SDK.

## Validation

- `packages/agent-claude/test/agent-claude-background-work.test.ts` holds these cases:
  - The backend offers a foreground Bash task.
  - Its move calls `backgroundTasks` with the tool_use id and answers `shell:<task id>`.
  - A subagent's move answers `subagent:<task id>`.
  - The backend offers no task that started in the background.
  - A `tool_result` withdraws the offer.
  - A `false` from the SDK answers `undefined`.
- `npx vitest run packages/agent-claude` passes.

## Resume

