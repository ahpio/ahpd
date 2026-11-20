---
title: The cofold truncation case reads a lock that Windows is deleting
status: open
date: 2026-11-19
severity: minor
refs:
  - "[code://packages/agent-cofold/test/agent-cofold-fork.test.ts#L555-L556](../../packages/agent-cofold/test/agent-cofold-fork.test.ts#L555-L556) - the wait that reads the session through a second store while the stopped run lets go of its writer"
  - "[code://packages/agent-cofold/test/agent-cofold-fork.test.ts#L47-L53](../../packages/agent-cofold/test/agent-cofold-fork.test.ts#L47-L53) - `untilAsync`, which lets an error of its check fail the case"
  - git://410423d71 - the last change to the case, which added the wait for the writer claim
  - https://github.com/ahpio/ahpd/actions/runs/44651449419/job/136007068387 - the failed job, `windows (3/4)` of #387
---

## Symptom

On 2026-11-19, `keeps the chat going when the store cannot truncate the conversation` in `agent-cofold-fork.test.ts` failed once in the Windows job `windows (3/4)` of #387 (`de95b698e`).
The error is `EPERM: operation not permitted, open '...\store\workspaces\...\sessions\one\writer.lock'`.
It comes from `readLock` in `@cofold/store-file` 0.2.2, called by `store.sessions.get` in the case's wait at line 556.
#387 changes only the bot plugin. The other 1970 cases of the job passed.

## Cause

The case waits until no run is running and the session holds no writer.
Its check reads the session through a second file store, and that read opens `writer.lock`.
The stopped run releases its claim at the same time, which deletes the file.
Windows refuses to open a file that is being deleted, with `EPERM`. Linux and macOS read it or find it gone.
`untilAsync` does not catch an error of its check, so the case fails instead of reading again.

## Impact

`check-windows` turns red at random on a PR that does not touch cofold, and a merge waits for it.

## Workaround

None. A rerun is not a fix.

## Fix

- The case's check catches `EPERM` from the read and answers `false`, so the wait reads again on the next tick.
- `@cofold/store-file` reads a lock that is being deleted as no lock, on Windows. That is a change in cofold, and every reader of a lock gets it.
