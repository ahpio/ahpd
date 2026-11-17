---
title: The daemon restart case waits a fixed 5 s for the old daemon to leave
status: open
date: 2026-11-17
severity: minor
refs:
  - "[code://packages/server/test/server-cli-restart.test.ts#L13-L32](../../packages/server/test/server-cli-restart.test.ts#L13-L32) - \"restarts a started daemon over HTTP with the line it was started with\""
  - "[code://packages/server/test/cli.ts#L145-L148](../../packages/server/test/cli.ts#L145-L148) - `gone`, a fixed 5 s wait"
  - "[code://tools/wait.ts](../../tools/wait.ts) - `WAIT_MS`, the suite's wait by the clock"
---

## Symptom

On 2026-11-17, at `a5bfe43a4` of host/20261117-2149, a full run of the server suite failed one case.
The load average was near 14.
The case was `server-cli-restart.test.ts`: "restarts a started daemon over HTTP with the line it was started with".
At line 32 it read the old daemon still alive, after `gone` had waited.
The same file passed twice alone on the same commit, 17 of 17 each time, at a load average from 10 to 2.
The branch changes no code on the restart's path.

## Cause

Likely, not proven.
`gone` waits a fixed 5 s for a pid to leave, where the suite waits by `WAIT_MS`.
A restart stops the old daemon after its successor answers, and a busy machine can take longer than 5 s for that.

## Impact

The server suite fails at random on a busy machine, and a full local run reads red.

## Workaround

None. Running it again is not a fix.

## Fix

No fix is chosen.

- Make `gone` wait by `WAIT_MS`, as the rest of the suite waits.
