---
title: A teardown waits out a busy folder - implemented
---

## What exists now

- `removeFolder` in `tools/holders.ts` tries again after an `EBUSY`, `EPERM` or `ENOTEMPTY`. The pause starts at 50 ms and doubles, and the last try comes at 5 s.
- A failure names the tries and the time waited, beside what is left and the holders seen.
- `removeFolder` takes `remove` and `ms`, so a case throws `EBUSY` on Linux. `clearFolder` and its 343 callers are unchanged.

## Verified

- `teardown-clear.test.ts` has 3 new cases: a folder busy twice then removed, a folder that stays busy, and an `EACCES` that fails at once.
- The sdk suite passed 5405 cases. Its 9 failures were schema cases, because the new worktree had no `node tools/schema.mjs`. After it, the 7 files of those cases pass.
- The computer suite passes, 696 cases. One run failed a bring-back case once, which its problem file now records.
- `pnpm typecheck` passes.

## Departures from the plan

- `pause` moved above `removeFolder`, which calls it now.
- The case of a folder that stays busy asks for 2 tries or more, not an exact count. A slow machine fits fewer tries.
