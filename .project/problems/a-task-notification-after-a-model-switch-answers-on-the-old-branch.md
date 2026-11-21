---
title: A task notification after a model switch answers on the old branch
status: open
date: 2026-11-21
severity: major
refs:
  - "[code://packages/agent-claude/src/session/query.ts#L853-L871](../../packages/agent-claude/src/session/query.ts#L853-L871) - `rebindForRestart` closes the old CLI and resumes a new one"
  - "[code://packages/agent-claude/src/session/query.ts#L822-L831](../../packages/agent-claude/src/session/query.ts#L822-L831) - `take` sends `setModel` to the CLI"
  - "[code://packages/agent-claude/src/session/parts.ts#L238-L265](../../packages/agent-claude/src/session/parts.ts#L238-L265) - `costOf` differences each CLI against its own baseline"
  - "[code://scripts/repair-claude-usage.mjs](../../scripts/repair-claude-usage.mjs) - its sum check reports the gap"
---

## Symptom

Two Claude CLIs wrote one conversation at the same time, after the user switched the model from Haiku to Sonnet.
The conversation forked into two branches, and the CLI's running total lost the spend of one of them.

The case is session `d5f25d91-b4ba-4d25-9e73-3010d89063a1`, chat `e5017385-2fd5-4fb4-b46e-a98e32024b59`, on 2026-11-21 (UTC):

| Time | Transcript entry | Model | Parent |
|---|---|---|---|
| 13:13:07 | `/model sonnet`, then the prompt "ok, merge when green" (turn `4dc6c6dc`) | | `7ada0b2a` |
| 13:13:52 | `compact_boundary`, and the turn goes on after it | Sonnet | none |
| 13:14:05 | A `task-notification` for the Monitor task `b3wuom16s` gets an answer | Haiku | `7ada0b2a` |
| 13:15:42 | The Haiku branch ends with "PR #414 is green" | Haiku | `4c19d3a2` |
| 13:15:42 | A `cost-state` line: total 20.6234, Haiku 1.6061 | | |
| 14:09:52 | A `cost-state` line: total 21.6566, Haiku 1.3696, Sonnet 1.2696 | | |

The Haiku answer at 13:14:05 has the parent of the `/model` entry, which is the entry before the switch and the compaction.
The Haiku figure goes back from 1.6061 to 1.3696, which is its figure in the 13:00:46 `cost-state`.
A single CLI keeps one running total, so two CLIs wrote these lines.

To see it again, run `node scripts/repair-claude-usage.mjs` and read the last line for this chat.
It says that the records sum to 22.1617 and that the transcript's last total is 21.9252.

## Cause

Unknown.
The facts limit it:

- The Sonnet CLI started from the 13:00:46 `cost-state`, so it started before the Haiku CLI wrote its 13:15:42 line.
- The Haiku CLI still ran after the switch, held the Monitor task, and answered its notification on the branch before the compaction.
- ahpd billed both CLIs. The Haiku records from 13:07 to 13:15 sum to 0.2364, and the Sonnet records from 13:15 to 13:57 sum to 1.2697.

What is not known is which of the two paths made the second CLI.
`rebindForRestart` closes the old query when the turn picks another agent, but a background task can keep the process alive after `close()`.
`take` changes the model in the same CLI, and that path starts no second one.

## Impact

- The user does not see some answers. The Haiku answer "PR #414 is green" is on a branch that no later turn follows.
- Two CLIs on one conversation can each take an action, such as a merge, from different contexts.
- The billing is correct, because each CLI was billed against its own baseline. The 0.2365 was spent.
- The CLI's running total is lower than the true spend. A seed from the last `cost-state` stays correct, because the CLI restores the same line.
- The sum check of `repair-claude-usage.mjs` reports a gap that is not a billing error.

## Workaround

None.
The repair script does not change these records, and that is correct.

## Fix

Candidates, none chosen:

- Wait until the old CLI exits before a new CLI resumes the conversation, and stop its background tasks first.
- Send a task notification from a replaced CLI to the current CLI, or drop it with a log line.
- In the repair script, tell a total that went back from a billing error, so that its sum check does not report this case.
