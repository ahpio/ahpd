---
title: The 51st session case runs at its 5 s budget
status: open
date: 2026-11-17
severity: minor
refs:
  - "[code://packages/sdk/test/sessiontools.test.ts#L1179-L1195](../../packages/sdk/test/sessiontools.test.ts#L1179-L1195) - \"refuses the 51st session in one tree, and still makes one in a second\""
  - "[code://vitest.config.ts#L34](../../vitest.config.ts#L34) - `testTimeout`, 5 s off Windows"
---

## Symptom

On 2026-11-17 the case timed out at 5000 ms in a full sdk run on Softov's machine, at a load average near 13.
The run was on daemon/20261118-0129, which does not change the session tools or this case.

| Run | Time |
| --- | --- |
| sdk suite, host/20261117-2149 follow-up | 4178 ms, passed |
| sdk suite, host/20261117-2336 | 4769 ms, passed |
| sdk suite, daemon/20261118-0129 | 5000 ms, timed out |

## Cause

The case starts 52 sessions in one case, through the session tools, and waits for each one.
On this machine that takes more than 80 percent of the 5 s budget when it passes, so a busy machine pushes it over.

## Impact

A local sdk run fails at random on a busy machine. No CI failure of this case is known.

## Workaround

None. Running the suite again is not a fix.

## Fix

No fix is chosen. The case needs a budget of its own that fits 52 sessions, or fewer sessions for the same check.
