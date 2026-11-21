---
title: A repair corrects the records billed with the past cost
status: todo
depends: [task-01-the-baseline-starts-from-the-transcript.md]
layer: "server"
refs:
  - "[code://packages/server/src/commands/usage.ts](../../../../packages/server/src/commands/usage.ts) - `ahpd usage`, which gets `repair`"
  - "[code://packages/sdk/src/usage/usage.ts#L328-L360](../../../../packages/sdk/src/usage/usage.ts#L328-L360) - how a month file's lines are read"
  - "[code://packages/agent-claude/src/transcript.ts#L319](../../../../packages/agent-claude/src/transcript.ts#L319) - `sessionFiles`, the transcript path"
---

## Objective

`ahpd usage repair` lists each Claude record that was charged a restored total, with its corrected cost.
With `--write`, it rewrites those records and keeps a copy of each month file it changed.

## Files

- `UPDATE: packages/server/src/commands/usage.ts` - add the `repair` subcommand and its `--write` flag.
- `UPDATE: packages/agent-claude/src/transcript.ts` - export `costStates(sessionId)`, the `cost-state` totals in file order.
- `CREATE: packages/server/test/usage-repair.test.ts` - the repair cases.
- `UPDATE: docs/server/USAGE.md` - say what `repair` does and when to run it.
- `UPDATE: .project/specs/usage.md` - add the repair.

## Steps

1. Export `costStates` to return each `cost-state` line's `modelUsage` costs, in file order.
2. In `repair`, read every record whose agent record has the engine `claude`, grouped by session, in time order.
3. Find each session's CLI session id the way agent-claude names it.
4. For each record, take the first `cost-state` total at or after the record's time as its total.
5. Set the corrected cost to that total minus the total the record before it got.
6. Mark a record when its recorded cost and its corrected cost differ by more than one cent.
7. Leave a session with no transcript unchanged, and print it as not checked.
8. Print each marked record: the time, the turn, the recorded cost and the corrected cost.
9. Print the sum of recorded and corrected costs for each session.
10. With `--write`, stop with an error when the daemon answers on its socket.
11. With `--write`, copy each month file to `<file>.bak-<time>` before the repair changes it.
12. With `--write`, write each marked record's `cost` and `providerCost` with the corrected amount.
13. Add a test: a session with four billed totals prints four marked records with the corrected amounts.
14. Add a test: a session with no transcript prints as not checked and is not changed.
15. Add a test: `--write` while the daemon runs stops and changes no file.
16. Add `repair` to `docs/server/USAGE.md` and `.project/specs/usage.md`.

## Validation

- `packages/server/test/usage-repair.test.ts` holds the three cases of steps 13 to 15.
- `pnpm --filter @ahpd/server test` passes.
- By hand: `ahpd usage repair` on this host lists turns `4dabf65f`, `e2fd0319`, `6d38a697` and `ba5f25ed` of session `d5f25d91` with costs under $1.

## Resume

