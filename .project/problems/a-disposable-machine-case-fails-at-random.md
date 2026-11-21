---
title: Two disposable machine cases fail at random
status: open
date: 2026-11-13
severity: minor
refs:
  - "[code://packages/computer/test/computer-disposable.test.ts#L755](../../packages/computer/test/computer-disposable.test.ts#L755) - \"keeps a session's machine across a restart, and lets it go when the session is disposed\""
  - "[code://packages/computer/test/computer-disposable.test.ts#L1628](../../packages/computer/test/computer-disposable.test.ts#L1628) - \"mounts the repository root for a session in a subfolder, and starts it in the subfolder\""
  - problems/three-cases-fail-at-random-on-windows.md - a third case of the same file, which timed out on Windows
---

## Symptom

| Case | Run | What it said |
| --- | --- | --- |
| keeps a session's machine across a restart | 43044491680, `processes (1/2)`, main | `expected true to be false`, at the check that no `rm` was recorded |
| mounts the repository root for a session in a subfolder | 42727088464, `windows (2/4)`, main | `Test timed out in 20000ms`, after 24.6 s |
| takes the machine's own git volume with it, and asks for none where the profile leaves it open | local, 2026-11-21, host/20261121-0821 at load near 15 | `expected false to be true`, at the check that `volume rm` was recorded, after 3.6 s; it then passed twice alone on that branch |
| takes the machine's own git volume with it, and asks for none where the profile leaves it open | local, 2026-11-21, host/20261121-1218 in the full computer suite | failed after 3.9 s; it then passed alone in its file |

## Cause

Unknown.
In the first case, the scripted Docker recorded an `rm` of the machine that the restarted daemon should hold for its session. The case waits for the log line that says the machine was found, and then for the delay to pass. The `rm` can come from the first daemon of the case, or from the second one before it adopts the machine.

## Impact

A CI job on main fails at random. If the first case shows a real race, a restart can remove the machine of a session that is still kept.

## Workaround

None. Running the job again is not a fix.

## Fix

- Record which daemon called `rm` in the first case, and when, against the line that says the machine is held.
- If the second daemon removes a machine before it adopts it, the fix is in the plugin, not in the case.
- Take the timings of the second case on a Windows runner.
- The second case was reported 4.6 s after its timeout, which says that a synchronous call blocked the event loop. Its own git setup now runs through `gitSync`, so a stall there fails at the call and names it.
