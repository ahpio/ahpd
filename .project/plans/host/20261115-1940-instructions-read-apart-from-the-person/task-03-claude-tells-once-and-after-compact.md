---
title: Claude is told the session's instructions once, and again after a compaction
status: todo
depends: []
layer: "agent-claude"
refs:
  - "[code://packages/agent-claude/src/session/query.ts#L190-L202](../../../../packages/agent-claude/src/session/query.ts#L190-L202) - `giveHostInstructions`, which gives them on every prompt"
  - "[code://packages/agent-claude/src/session/query.ts#L1084-L1091](../../../../packages/agent-claude/src/session/query.ts#L1084-L1091) - the `compact_boundary` reader"
  - "[code://packages/agent-claude/src/session/context.ts#L358](../../../../packages/agent-claude/src/session/context.ts#L358) - `hostInstructions`, beside which the new flag lives"
  - "[code://packages/agent-claude/test/agent-claude-background-work.test.ts#L565-L605](../../../../packages/agent-claude/test/agent-claude-background-work.test.ts#L565-L605) - the case that runs the `UserPromptSubmit` hook"
---

## Objective

The `UserPromptSubmit` hook gives the session's instructions on the chat's first prompt and on the first prompt after a compaction.
A turn's own instructions still go with that turn.

## Files

- `UPDATE: packages/agent-claude/src/session/context.ts:358` - add `instructionsGiven: boolean`, set from `options.resume`.
- `UPDATE: packages/agent-claude/src/session/query.ts:190-202` - give `options.instructions` only while the flag is down, then raise it.
- `UPDATE: packages/agent-claude/src/session/query.ts:1084-1091` - lower the flag on `compact_boundary`.
- `UPDATE: packages/agent-claude/test/agent-claude-background-work.test.ts` - cases for the first prompt, the second prompt and the prompt after a compaction.

## Steps

1. Add `instructionsGiven` to the session context, `true` when the session opens with `resume`, `false` otherwise.
2. In `giveHostInstructions`, include `ctx.options.instructions` only when `instructionsGiven` is `false`.
3. Raise `instructionsGiven` when the hook returns them.
4. Lower `instructionsGiven` in the `compact_boundary` branch, whether or not a turn is active.
5. Update the comment on `giveHostInstructions` to say when the session's instructions are given, with the reference link.
6. Add the three test cases with `options.instructions` set, and one for a resumed session.

## Validation

- `npx vitest run packages/agent-claude/test/agent-claude-background-work.test.ts` passes.
- `npx vitest run packages/agent-claude` passes.
- `pnpm typecheck` passes.

## Resume

