---
title: A real CLI repeats the switch
status: done
depends: [task-01-a-start-waits-for-the-cli-before-it.md]
layer: "agent-claude"
refs:
  - "[code://packages/agent-claude/src/session/query.ts#L868-L885](../../../../packages/agent-claude/src/session/query.ts#L868-L885) - `rebindForRestart`, one of the start paths"
---

## Objective

A test daemon with a real CLI runs the 2026-11-21 sequence, and the conversation has one CLI from start to end.

## Files

- `UPDATE: .project/plans/claude/20261128-0534-one-cli-runs-a-conversation/implemented.md` - the probe's result.

## Steps

1. Start a test daemon with its own XDG folders, on ports other than 5180 and 37537.
2. Open a Claude session on Haiku, and start a Monitor task in the background.
3. Switch the model to Sonnet, and send a prompt while the task runs.
4. Count the CLI processes of the conversation during the switch, with `ps`.
5. Read the transcript, and check that each entry after the switch has the parent of the entry before it.
6. Repeat with an agent change and with a record edit, which take the other start paths.

## Validation

- At most one CLI of the conversation runs at any time.
- The transcript has one branch after each switch.
- The `cost-state` totals go up and never back.

## Resume

Run on 2026-11-28 with a script that drives `createSession` over the real SDK, not a test daemon: the start paths are the session's own. Before the host spawned the CLI, the agent change ran two CLIs for 0.6 s. After it, three runs had one CLI throughout.
