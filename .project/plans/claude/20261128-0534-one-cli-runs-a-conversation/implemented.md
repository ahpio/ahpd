---
title: One CLI runs a conversation - implemented
date: 2026-11-28
refs:
  - "[code://packages/agent-claude/src/session/clis.ts](../../../../packages/agent-claude/src/session/clis.ts)"
  - "[code://packages/agent-claude/src/session/ownspawn.ts](../../../../packages/agent-claude/src/session/ownspawn.ts)"
  - "[code://packages/agent-claude/src/session/query.ts](../../../../packages/agent-claude/src/session/query.ts)"
---

A conversation runs on one Claude CLI at a time in a host. Every start closes the CLI still on its conversation, in any session of the agent, and waits for its process to exit.

## What was built

- [`code://packages/agent-claude/src/session/clis.ts`](../../../../packages/agent-claude/src/session/clis.ts) - the live CLIs of one agent by conversation id, and their close, stop and wait.
- [`code://packages/agent-claude/src/session/ownspawn.ts`](../../../../packages/agent-claude/src/session/ownspawn.ts) - the spawn hook: the exit of each CLI, and the end of its stderr in its failure.
- [`code://packages/agent-claude/src/session/query.ts`](../../../../packages/agent-claude/src/session/query.ts) - `startQuery` stops the CLIs on the conversation it writes, and `putAway` stops its CLI. `consume` reads no frame of a CLI that was replaced or closed.
- [`code://packages/agent-claude/src/session.ts`](../../../../packages/agent-claude/src/session.ts) - a disposed session stops its CLI and forgets it after the exit.
- [`code://packages/agent-claude/src/spawn.ts`](../../../../packages/agent-claude/src/spawn.ts) - the machine spawn's stand-in process calls a copy of its listeners.

## Verified

- `one-cli-a-conversation.test.ts`: 8 cases over the scripted SDK. With the fix off, the putAway, agent change, record edit, second session and late exit cases fail.
- `own-spawn.test.ts`: a CLI on this host exits with its stderr tail, and a CLI in a machine exits through the session's hook. A stop waits past the SDK's close.
- The agent-claude suite passes 749 cases and the sdk suite 5431.
- A script over the real SDK repeated the 2026-11-21 sequence on Haiku and Sonnet, as [task 02](task-02-a-real-cli-repeats-the-switch.md) says. Three runs had one CLI throughout and one branch in the transcript.

## Departures from the plan

- The host spawns the CLI itself. With `close()` and the SDK's exit alone, the agent change ran two CLIs for 0.6 s.
- The map of exits became `Clis`, a map of live CLIs, in its own file.
- The machine spawn skipped the listener after a `once` listener that removed itself. The spawn hook's exit listener made four spawn failure cases time out, so the stand-in process now calls a copy of its listeners.
- A stop and a login move close their CLI through `closeCli`, so `consume` does not report the end as a failure.

## Left for later

- A conversation that two daemons open still runs two CLIs, as *Answers* chose.
