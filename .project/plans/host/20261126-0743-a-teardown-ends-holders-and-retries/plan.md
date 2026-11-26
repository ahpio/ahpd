---
title: A teardown ends the folder's holders and retries its removal
domain: host
status: active
priority: high
created: 2026-11-26
revalidated: 2026-11-26
refs:
  - git://ba8e21862 - main when the plan was made, and the last commit that holds the problem file `a-test-removes-its-folder-while-a-child-writes-in-it.md`
  - "[code://tools/holders.ts#L60-L106](../../../../tools/holders.ts#L60-L106) - `endHolders` and `removeFolder`, which two suites use and the rest do not"
  - "[code://packages/computer/test/computer-disposable.test.ts#L59](../../../../packages/computer/test/computer-disposable.test.ts#L59) - a teardown that ends its holders, the pattern to reuse"
---

## Goal

A test that removes its temp folder in a teardown never fails on `ENOTEMPTY` or `EBUSY`. The failure hit CI at least 9 times, the last two on #481 and #489 on 2026-11-26.

## Reconnaissance

- 268 removals with `rmSync(..., { recursive: true })` sit in an `afterEach`, `afterAll` or `finally` block of a test.
- A child process can still write in the folder as it is removed, and Windows can release a handle late. The problem file names both.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A teardown ends every process whose environment names the folder, then removes it with Node's own retry | Softov, 2026-11-26, chose "Both: end holders, then retry" | 01 |
| `clearFolder` is synchronous, so it drops into any teardown as the removal it replaces | (defaulted: many teardowns are not async) | 01 |
| Only a removal in an `afterEach`, `afterAll` or `finally` block changes; one in the middle of a case stays | (defaulted: ending a holder mid-case could end a process the case still uses) | 02 |
| The two new tests are in `packages/sdk/test`, beside the suites that use `tools/holders.ts` | (defaulted: the shards are timed per test file there) | 02 |
| A test refuses a bare removal in a teardown | (defaulted: the fix holds only if no new teardown skips it) | 02 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - a-folder-is-cleared-in-one-call](task-01-a-folder-is-cleared-in-one-call.md) | done | - |
| [02 - every-teardown-clears-its-folder](task-02-every-teardown-clears-its-folder.md) | done | 01 |

## Risks and tradeoffs

- Reading `/proc` at each teardown adds some milliseconds to each case on Linux.
- A teardown that waits on a holder that will not end waits up to its limit, then fails with the holder named.

## Resume state

- **Done so far:** both tasks, on 2026-11-26. [implemented.md](implemented.md) holds the checks.
- **Next action:** Softov's review, and `check-windows` over more runs.
- **Open questions:** none.
- **Watch out for:** a removal in the middle of a case stays as it is.

## Final verification checklist

- [x] Every teardown removal uses `clearFolder`, and the check passes.
- [ ] The full suite passes on Linux, and `check-windows` passes.
