---
title: A start waits for the CLI before it
status: todo
depends: []
layer: "agent-claude"
refs:
  - "[code://packages/agent-claude/src/session/query.ts#L778-L795](../../../../packages/agent-claude/src/session/query.ts#L778-L795) - the wait in `startQuery`"
  - "[code://packages/agent-claude/src/session.ts#L400-L419](../../../../packages/agent-claude/src/session.ts#L400-L419) - the exit kept under each conversation id"
---

## Objective

A CLI on a conversation is known to every session of the agent until it exits. Every start closes it and waits for its exit first, `putAway` closes its CLI, and `consume` reads only the current CLI.

## Files

- `UPDATE: packages/agent-claude/src/claude.ts:243` - the map of exits becomes the map of live CLIs by conversation id, with each one's exit.
- `UPDATE: packages/agent-claude/src/session/context.ts:97` - the option's type and its comment.
- `UPDATE: packages/agent-claude/src/session/query.ts:778-795` - every start closes the CLI of the conversation and waits for its exit, and keeps its own CLI in the map.
- `UPDATE: packages/agent-claude/src/session/query.ts:417-426` - `putAway` closes the CLI it puts away.
- `UPDATE: packages/agent-claude/src/session/query.ts:1078-1083` - `consume` reads no frame of a CLI that is not `ctx.query`.
- `UPDATE: packages/agent-claude/src/session.ts:400-419` - a disposed session's CLI stays in the map until it exits.
- `CREATE: packages/agent-claude/test/one-cli-a-conversation.test.ts` - the cases over the scripted SDK.

## Steps

1. Keep each started CLI in the shared map under its conversation ids, with a promise of its exit.
2. Remove the entry when that CLI exits, only where the entry is still that CLI.
3. In `startQuery`, before `startup`, close every live CLI of the conversation and wait for its exit.
4. Fail the start in its own words when a CLI does not exit before the SDK's bound.
5. Close the handle in `putAway`, and keep it in `ctx.rebind` as now.
6. In `consume`, stop the loop when `mine` is not `ctx.query` and no start is replacing it.
7. Write a case for each start path: `putAway`, `rebindForRestart`, `rebindForSyncedState`, `restartAt` and a second session.
8. Write a case where the old CLI exits late: the new CLI starts only after that exit.

## Validation

- `one-cli-a-conversation.test.ts` passes, with a case for each start path.
- The agent-claude suite passes.
- The sdk suite passes.
- `pnpm typecheck` passes.

## Resume
