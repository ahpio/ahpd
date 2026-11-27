---
title: A teardown waits out a busy folder
domain: host
status: active
priority: high
created: 2026-11-27
revalidated: 2026-11-27
requires:
  - plans/host/20261126-0743-a-teardown-ends-holders-and-retries/plan.md
refs:
  - git://6cd0beda1 - main when the plan was made, and the last commit that holds the problem file `a-closed-hosts-scratch-folder-is-busy-on-windows.md`
  - "[code://tools/holders.ts#L82-L107](../../../../tools/holders.ts#L82-L107) - `removeFolder`, which relies on the retry of `rmSync`"
  - "[code://tools/holders.ts#L109-L110](../../../../tools/holders.ts#L109-L110) - `pause`, the synchronous wait `endHoldersNow` uses"
  - "[code://packages/sdk/test/teardown-clear.test.ts](../../../../packages/sdk/test/teardown-clear.test.ts) - the cases of `clearFolder`"
  - "[code://packages/sdk/test/host-chats.test.ts#L1946-L1972](../../../../packages/sdk/test/host-chats.test.ts#L1946-L1972) - the case that failed"
---

## Goal

A teardown on Windows never fails on `EBUSY` while another process still lets go of the folder. The case in `host-chats.test.ts` failed that way on #496 on 2026-11-27.

## Reconnaissance

- `removeFolder` calls `rmSync` with `maxRetries: 10` and `retryDelay: 100`, and relies on it to wait.
- The failed case took 265 ms in all, so `rmSync` threw `EBUSY` with no wait between tries.
- CI runs Node 22. Its synchronous `rm` waits between tries of a directory only on `ENOTEMPTY`, `EEXIST` and `EPERM`, as far as the case shows.
- `Holders: none` on Windows means only that no fake CLI left a mark: there is no `/proc` to read.

## Answers

| What | Source | Task |
| --- | --- | --- |
| `removeFolder` retries an `EBUSY`, `EPERM` or `ENOTEMPTY` itself, with a pause between tries, up to 5 s | Softov, 2026-11-27, chose "Retry in removeFolder" | 01 |
| The wait stays synchronous, so every teardown keeps `clearFolder` as it is | Softov, 2026-11-27, chose "Retry in removeFolder" | 01 |
| The pause doubles from 50 ms, and the last try comes at the limit | (defaulted: a short first wait for the usual case, few tries for a long one) | 01 |
| A failure names the tries and the time waited, beside what is left | (defaulted: a failure on a runner must say whether the wait ran) | 01 |
| The remover is a parameter, so a case can throw `EBUSY` on Linux | (defaulted: CI's Windows job is the only other place the error happens) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - a-busy-folder-is-tried-again](task-01-a-busy-folder-is-tried-again.md) | done | - |

## Risks and tradeoffs

- The pause blocks the event loop. A handle that the test's own process holds cannot close during the wait, so such a holder still fails, after 5 s.
- A teardown that fails waits 5 s more before it says so.

## Resume state

- **Done so far:** task 01, on 2026-11-27. [implemented.md](implemented.md) holds the checks.
- **Next action:** Softov's review, and `check-windows` over more runs.
- **Open questions:** none.
- **Watch out for:** a case in the middle of a test still calls `rmSync`, and keeps it.

## Final verification checklist

- [x] `teardown-clear.test.ts` passes, with the new cases.
- [ ] `check-windows` passes.
