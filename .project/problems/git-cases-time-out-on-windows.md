---
title: Cases that run git fail at random on Windows
status: open
date: 2026-11-13
severity: minor
refs:
  - "[code://packages/sdk/test/changes-refresh.test.ts#L217](../../packages/sdk/test/changes-refresh.test.ts#L217) - \"re-reads a changeset when git is changed outside the host\""
  - "[code://packages/sdk/test/changes-refresh.test.ts#L1332](../../packages/sdk/test/changes-refresh.test.ts#L1332) - \"moves a worktree row at a tool call, from its branch, before the turn ends\""
  - "[code://packages/sdk/test/worktrees.test.ts#L839](../../packages/sdk/test/worktrees.test.ts#L839) - \"answers the branches a client types for, not the whole list\""
  - "[code://packages/sdk/test/worktrees.test.ts#L1346](../../packages/sdk/test/worktrees.test.ts#L1346) - \"takes away and puts back a tree a move left the session, as its own\""
---

## Symptom

Four cases that run `git` fail at random in `windows (3/4)`, and pass when the job runs again on the same commit. They pass on Linux.

| Case | Run | What it said |
| --- | --- | --- |
| changes-refresh, "re-reads a changeset when git is changed outside the host" | 42760023503 | `Test timed out in 20000ms`, after 23.8 s |
| worktrees, "answers the branches a client types for" | 42760023503 | `Test timed out in 20000ms`, after 24.6 s |
| changes-refresh, "moves a worktree row at a tool call" | 42984895620 | `git worktree list --porcelain`: `fatal: failed to read .git/worktrees/s/commondir: No error` |
| worktrees, "an archived session's tree > takes away and puts back a tree a move left the session" | 44172119274, on #368, which changes only `tunnel-devtunnel` | `never logged "put ...project.worktrees\left back on agents/left"`, after 20.6 s |

## Cause

Unknown.
Each `git` call is a new process, and a Windows runner is slow to start one. The first two cases make many calls in one run.
In the third case, the test's own `git worktree list` read the worktree folder while the host was still writing it.

Plan host/20261113-2331 fixes the third case: `openInTree` takes a `git` read that fails as a tree not there yet.

## Impact

A Windows CI job fails at random, and blocks a merge until it runs again.

## Workaround

None. Running the job again is not a fix.

## Fix

No fix is chosen for the two cases left.
They are changes-refresh, "re-reads a changeset when git is changed outside the host", and worktrees, "answers the branches a client types for".

- Each passes in about a second, and failed once after more than 20 s, so something stalled rather than ran slow. The host already reads a changeset again once its watch is armed, so a late watch is not the first case's cause.
- Since host/20261117-2149, a Windows CI job writes each `git` call over 2 s to stderr as a `slow git:` line. The next failure of either case says which call stalled, if one did, and that decides the fix.
- Each case was reported about 4 s after its 20 s timeout, which says that a synchronous call blocked the event loop. The synchronous calls of each case are its own git setup.
- Since host/20261117-2336, a test runs its own git through `gitSync`, with a timeout of `WAIT_MS` and the same `slow git:` line. A stall in that setup fails at the call and names it.

The third case is fixed by host/20261113-2331.
The moved-tree case, "takes away and puts back a tree a move left the session", is fixed by host/20261117-2149.
Its git work outgrew the 20 s budget on a slow runner, so it now waits by `WAIT_MS` and has 60 s on Windows.
