---
title: A resumed Claude session bills its whole past cost to one turn
status: open
date: 2026-11-21
severity: major
refs:
  - "[code://packages/agent-claude/src/session/parts.ts#L160](../../packages/agent-claude/src/session/parts.ts#L160) - `paid`, the baseline per model, empty in each new query"
  - "[code://packages/agent-claude/src/session/parts.ts#L192](../../packages/agent-claude/src/session/parts.ts#L192) - `costOf`, the turn's cost as the change in `modelUsage` since the last `result`"
  - "[code://packages/agent-claude/src/session/parts.ts#L172](../../packages/agent-claude/src/session/parts.ts#L172) - `newConversation`, the only reset of the baseline"
  - "[code://packages/agent-claude/src/session/query.ts#L1442](../../packages/agent-claude/src/session/query.ts#L1442) - where the cost goes on the turn's usage"
  - "[code://packages/agent-claude/src/session/query.ts#L653](../../packages/agent-claude/src/session/query.ts#L653) - the query resumes the CLI session by its id"
  - npm://@anthropic-ai/claude-agent-sdk@0.3.325 - the CLI writes a `cost-state` entry to the transcript and restores it on resume
  - git://76ab8bbba2605c9bfa47cabc89fb262106aa3541 - the commit the code was read at
---

## Symptom

The first turn of each new CLI process on an existing session is charged the session's whole earlier cost.
Session `d5f25d91-b4ba-4d25-9e73-3010d89063a1` on this host shows it four times:

| Turn | Tokens | Recorded | Real |
|---|---|---|---|
| `4dabf65f` | 2192 out, 255K read, 45K write | $19.27 | about $0.25 |
| `e2fd0319` | none | $19.27 | $0 |
| `6d38a697` | 1551 out, 351K read, 4K write | $20.02 | about $0.02 |
| `ba5f25ed` | 482 out, 80K read, 81K write | $21.87 | about $0.33 |

Each recorded amount is the sum of every earlier turn plus the turn's own cost.
The session's records add up to $102.10, and its real cost is about $22.
The CLI transcript `~/.claude/projects/-github-ahpd/d5f25d91-b4ba-4d25-9e73-3010d89063a1.jsonl` holds `cost-state` totals of 19.017, 19.995 and 21.657, which are the amounts billed again.

To show it again:

1. Run two turns on a Claude session.
2. End the agent process, for example by a daemon restart or a model change.
3. Send one more turn.
4. Read the session's lines in `usage/<YYYY-MM>-model.jsonl`. The last turn's `cost.amount` holds the earlier turns' total.

## Cause

The CLI keeps its running cost in the transcript as a `cost-state` entry, and a resumed CLI restores it.
Each `result` then reports `modelUsage[model].costUSD` as the total since the session began, not since the process started.
`costOf` subtracts the last figure it saw, which it keeps in `paid`.
A new query starts with `paid` empty, so the first `result` bills the restored total as a spend.
`newConversation` clears `paid` on `conversation_reset` only, and nothing seeds it on resume.

## Impact

- Every pool that the turn charges gets the past cost again: the owner, the team, the project and each policy key.
- A limit trips early, because it reads the store's total for its key.
- The figure a client shows for the turn is wrong.
- A turn with no tokens can carry a cost, as `e2fd0319` shows.
- The token counts are right. Only `cost` and `providerCost` are wrong.

## Workaround

None.

## Fix

Candidates, none chosen yet:

- **Seed the baseline from the transcript.** Before the query resumes, read the last `cost-state` entry and set `paid` from its `modelUsage`. It is exact, but it reads a CLI entry that no public type describes.
- **Price the first result from its tokens.** The first `result` of a resumed query gets its cost from the host's price list, with `from: 'price'`. Results after it take the difference. A model with no price row gets no cost on that turn.
- **Send no cost on the first result.** The first `result` of a resumed query sends tokens and no cost. It is small and safe, but each resumed turn loses its cost.
- **Correct the records already written.** One of the fixes above stops new wrong records. The records already in the store stay wrong unless a repair rewrites them.
