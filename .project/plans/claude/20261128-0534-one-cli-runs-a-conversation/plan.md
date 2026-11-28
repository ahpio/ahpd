---
title: One CLI runs a conversation
domain: claude
status: planned
priority: high
created: 2026-11-28
revalidated: 2026-11-28
refs:
  - git://7f6fe14c8 - main when the plan was made, and the last commit that holds the problem file `a-task-notification-after-a-model-switch-answers-on-the-old-branch.md`
  - "[code://packages/agent-claude/src/session/query.ts#L778-L795](../../../../packages/agent-claude/src/session/query.ts#L778-L795) - `startQuery`, which waits for the last CLI to exit only when it starts a conversation under a new id"
  - "[code://packages/agent-claude/src/session/query.ts#L417-L426](../../../../packages/agent-claude/src/session/query.ts#L417-L426) - `putAway`, which keeps its CLI open"
  - "[code://packages/agent-claude/src/session/query.ts#L1078-L1083](../../../../packages/agent-claude/src/session/query.ts#L1078-L1083) - `consume`, which reads on a CLI that is no longer the current one"
  - "[code://packages/agent-claude/src/session.ts#L400-L419](../../../../packages/agent-claude/src/session.ts#L400-L419) - a disposed session's exit, kept under each conversation id"
  - "[code://packages/agent-claude/src/claude.ts#L243](../../../../packages/agent-claude/src/claude.ts#L243) - `exits`, the map of exits the sessions of one agent share"
  - "[code://packages/agent-claude/src/session/logins.ts#L315-L345](../../../../packages/agent-claude/src/session/logins.ts#L315-L345) - `restartAt`, a restart path"
---

## Goal

One conversation has at most one Claude CLI in a host. On 2026-11-21, two CLIs wrote one conversation after a switch from Haiku to Sonnet. The old CLI answered a task notification on a branch that no later turn follows.
The CLI's running total lost the spend of one of them.

## Reconnaissance

- The case is in the problem file at the `git://` ref. Its cause is not known.
- The host billed frames of the old CLI after the new one started, so both CLIs ran in this host.
- `startQuery` waits for a CLI's exit only before a start under a new id, and only for a disposed session's CLI.
- `putAway` keeps its CLI open and holds it in `ctx.rebind`. The next send starts a new CLI and does not close it.
- `rebindForRestart`, `rebindForSyncedState` and `restartAt` call `close()` and do not wait for the exit.
- A probe on 2026-11-21 saw a CLI that holds a background task exit 2 s after `close()`.
- `consume` stops reading a CLI only when it is in `ctx.rebind`.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Every start of a CLI on a conversation first closes the CLI still on it, in any session of this host, and waits for it to exit | Softov, 2026-11-28, chose "One CLI per conversation" | 01 |
| `putAway` closes the CLI it puts away | Softov, 2026-11-28, chose "One CLI per conversation" | 01 |
| No lock across hosts | Softov, 2026-11-28, chose "One CLI per conversation" over "Also lock across hosts" | - |
| The CLIs are kept by conversation id in the map that `exits` is now, from their start until their exit | (defaulted: `exits` is already shared by the sessions of one agent) | 01 |
| A background task of the old CLI ends with it | (defaulted: VS Code ends it on a rebind) | 01 |
| `consume` reads no frame of a CLI that is not the session's current one | (defaulted: a CLI that was replaced has no turn to answer) | 01 |
| A CLI that does not exit before the SDK's own bound fails the start, in the start's words | (defaulted: a start must not run beside a CLI it could not stop) | 01 |
| The 2026-11-21 sequence is repeated with a real CLI on Haiku, as the probes of that day were | (defaulted: the cause is not known, so a real run is the check) | 02 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - a-start-waits-for-the-cli-before-it](task-01-a-start-waits-for-the-cli-before-it.md) | todo | - |
| [02 - a-real-cli-repeats-the-switch](task-02-a-real-cli-repeats-the-switch.md) | todo | 01 |

## Risks and tradeoffs

- A start after a rebind waits for the old CLI to exit, about 2 s with a background task.
- A Monitor or other background task of the old CLI ends at the switch, and its notification does not come.
- A conversation that two daemons open still runs two CLIs.

## Resume state

- **Done so far:** nothing.
- **Next action:** task 01.
- **Open questions:** none.
- **Watch out for:** a CLI in a machine (`ctx.options.spawn`) is closed and waited for the same way. Its transcript is out of this host's reach.

## Final verification checklist

- [ ] No start runs while another CLI of the conversation is alive, on every start path.
- [ ] A real CLI repeats the 2026-11-21 switch with one CLI on the conversation.
- [ ] The agent-claude and sdk suites pass, and `check-windows` passes.
