---
title: A start waits for the CLI before it
status: done
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
- `UPDATE: packages/agent-claude/src/spawn.ts` - the machine spawn's stand-in process calls a copy of its listeners, so a listener that removes itself skips no other.
- `UPDATE: packages/agent-claude/src/session/turns.ts` - a stop closes its CLI through `closeCli`.
- `UPDATE: packages/agent-claude/src/session/logins.ts:315-345` - `restartAt` closes its CLI through `closeCli`.
- `CREATE: packages/agent-claude/src/session/clis.ts` - the map of live CLIs, and their close and wait.
- `CREATE: packages/agent-claude/src/session/ownspawn.ts` - the spawn hook, the exit of each CLI, and its stderr tail.
- `CREATE: packages/agent-claude/test/one-cli-a-conversation.test.ts` - the cases over the scripted SDK.
- `CREATE: packages/agent-claude/test/own-spawn.test.ts` - the spawn, its exit and the stderr tail.

## Steps

1. Keep each started CLI in the shared map under its conversation ids, with a promise of its exit.
2. Remove the entry when that CLI exits, only where the entry is still that CLI.
3. In `startQuery`, before `startup`, close every live CLI of the conversation and wait for its exit.
4. Mark each CLI this host closes, so that its end does not put it away.
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

Built on 2026-11-28. Every start reads the CLIs on its conversation and closes them first. It waits only where one runs, so a new chat binds as soon as before. The wait goes to the process's own exit, through the host's spawn hook. A CLI this host closes ends silently, because an agent change closed the old CLI before it set the new one.
