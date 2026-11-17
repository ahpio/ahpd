---
title: The Windows git cases stop failing at random
domain: host
status: planned
priority: medium
created: 2026-11-17
revalidated: 2026-11-17
refs:
  - "[code://.project/problems/git-cases-time-out-on-windows.md](../../../problems/git-cases-time-out-on-windows.md) - the cases, their failures, and the third one fixed by host/20261113-2331"
  - "[code://packages/sdk/src/sessions/changes.ts#L1982-L2108](../../../../packages/sdk/src/sessions/changes.ts#L1982-L2108) - the git watch, armed only after two `git rev-parse` processes"
  - "[code://packages/sdk/test/changes-refresh.test.ts#L217](../../../../packages/sdk/test/changes-refresh.test.ts#L217) - \"re-reads a changeset when git is changed outside the host\", which runs `git add` 8 turns after the subscribe"
  - "[code://packages/sdk/test/worktrees.test.ts#L1263-L1270](../../../../packages/sdk/test/worktrees.test.ts#L1263-L1270) - `logged`, a fixed 400 tries of 10 ms"
  - "[code://packages/sdk/test/worktrees.test.ts#L1346](../../../../packages/sdk/test/worktrees.test.ts#L1346) - \"takes away and puts back a tree a move left the session\""
  - "[code://packages/sdk/test/worktrees.test.ts#L839](../../../../packages/sdk/test/worktrees.test.ts#L839) - \"answers the branches a client types for\", whose one failure left no log"
  - "[code://packages/sdk/src/repo/hardened.ts#L49-L62](../../../../packages/sdk/src/repo/hardened.ts#L49-L62) - `runGit`, which every git call of the sdk goes through"
  - "[code://tools/wait.ts](../../../../tools/wait.ts) - `WAIT_MS`, the suite's wait by the clock"
---

## Goal

The three git cases that fail at random on Windows stop failing, or say why the next time they fail.
Each has its own cause, read from the code and from the timings of 17 passing `windows (3/4)` runs.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

| Case | Passing runs | Failure | Cause |
| --- | --- | --- | --- |
| changes-refresh, "re-reads a changeset when git is changed outside the host" | 0.9 s to 2.8 s | 23.8 s, timeout | the watch arms after two git processes, and `git add` can come first |
| worktrees, "takes away and puts back a tree a move left the session" | 2.6 s to 9.6 s | 20.6 s, `never logged` | its git work outgrew the 20 s budget on a slow runner |
| worktrees, "answers the branches a client types for" | 0.5 s to 1.2 s | 24.6 s, timeout | unknown; no log of the failed run survives |

### Searches performed

- `gh run view` over the last 30 CI runs - the times of each case in every `windows (3/4)` log that is kept.
- `rg "runGit" packages/sdk/src` - every git call of the sdk goes through `runGit`.

### Gaps

- A change between a changeset's first read and its watch being armed is not read until the next trigger.
- `logged` waits a fixed number of tries, where the suite waits by `WAIT_MS`.
- No log says which git call was slow.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The git watch fires its change once when it is armed | Softov, 2026-11-17: "Re-read once when armed" | 01 |
| `logged` waits by `WAIT_MS`, and the moved-tree case has 60 s on Windows | Softov, 2026-11-17: "Wait by the clock, bigger budget" | 02 |
| Each git call over 2 s is logged at debug level, with its arguments and its time | Softov, 2026-11-17: "Log each git call's time" | 03 |
| The slow call also goes to stderr where `AHPD_GIT_SLOW_MS` is set, and the Windows CI jobs set it to 2000 | (defaulted: nothing prints a test host's log on CI, and the next failure has to name the call) | 03 |
| The branches case stays in the problem file until it fails again | Softov, 2026-11-17: "Log each git call's time" | 03 |

## Proposed architecture

- **Data flow** - the watch's `ready` ends with one `onChange`, through the same 150 ms debounce as a file event.
- **Event flow** - `runGit` times each call from start to close, and says one over the limit to its listener.
- **Layer responsibilities** - sdk: `changes.ts`, `hardened.ts`, `host.ts` · tests: `changes-refresh.test.ts`, `worktrees.test.ts` · CI: the Windows jobs' env.
- **Source-of-truth files** - [`code://packages/sdk/src/repo/hardened.ts`](../../../../packages/sdk/src/repo/hardened.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - the git watch reads once when armed](task-01-the-git-watch-reads-once-when-armed.md) | todo | - |
| [02 - the moved-tree case waits by the clock](task-02-the-moved-tree-case-waits-by-the-clock.md) | todo | - |
| [03 - a slow git call says so](task-03-a-slow-git-call-says-so.md) | todo | - |

## Risks and tradeoffs

- Each watched directory reads its changeset once more, when its watch is armed - one read, coalesced with any event in the same 150 ms.
- The moved-tree case may take up to 60 s on a slow Windows runner - the archive work is not made faster here.
- The branches case is not fixed - its next failure names the slow call, and a plan follows from that.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-the-git-watch-reads-once-when-armed.md](task-01-the-git-watch-reads-once-when-armed.md).
- **Open questions:** none.
- **Watch out for:** a case that is green once on Windows proves little; the CI runs after the merge are what count.

## Final verification checklist

- [ ] The sdk and computer suites pass, and `check-windows` is green.
- [ ] A run with `AHPD_GIT_SLOW_MS=1` prints a slow-git line to stderr for a case that runs git.
