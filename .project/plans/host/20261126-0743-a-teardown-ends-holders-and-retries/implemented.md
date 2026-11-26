---
title: A teardown ends the folder's holders and retries its removal - implemented
date: 2026-11-26
refs:
  - "[code://tools/holders.ts](../../../../tools/holders.ts) - `endHoldersNow` and `clearFolder`"
  - "[code://packages/sdk/test/teardown-check.test.ts](../../../../packages/sdk/test/teardown-check.test.ts) - the check of every teardown"
---

Every test teardown removes its temp folder with `clearFolder`.
It ends each process whose environment names the folder, then removes the folder with Node's own retry.
A test fails on a bare `rmSync(..., { recursive })` in an `afterEach`, an `afterAll` or a `finally` block, and names its file and line.

## What was built

- [`code://tools/holders.ts`](../../../../tools/holders.ts) - `endHoldersNow`, which waits with `Atomics.wait`, and `clearFolder`.
- 343 teardown removals in 261 test files now call `clearFolder`. A removal in the middle of a case is as it was.
- [`code://packages/sdk/test/teardown-clear.test.ts`](../../../../packages/sdk/test/teardown-clear.test.ts) - a child that writes in the folder is ended, and a missing folder is no error.
- [`code://packages/sdk/test/teardown-check.test.ts`](../../../../packages/sdk/test/teardown-check.test.ts) - the check.

## Verified

- `pnpm typecheck` passes, and the suite of each package passes on Linux.

## Departures from the plan

- The two new tests are in `packages/sdk/test`, not `tools`, because the shards are timed per test file there.

## Left for later

- `check-windows` over several runs says whether the Windows failures stop.
