---
title: Three disposable machine cases fail at random
status: open
date: 2026-11-13
severity: minor
refs:
  - "[code://packages/computer/test/computer-disposable.test.ts#L755](../../packages/computer/test/computer-disposable.test.ts#L755) - \"keeps a session's machine across a restart, and lets it go when the session is disposed\""
  - "[code://packages/computer/test/computer-disposable.test.ts#L1628](../../packages/computer/test/computer-disposable.test.ts#L1628) - \"mounts the repository root for a session in a subfolder, and starts it in the subfolder\""
  - "[code://packages/computer/test/computer-disposable.test.ts#L2040](../../packages/computer/test/computer-disposable.test.ts#L2040) - \"takes the machine's own git volume with it, and asks for none where the profile leaves it open\""
  - "[code://packages/computer/test/computer-disposable.test.ts#L50-L63](../../packages/computer/test/computer-disposable.test.ts#L50-L63) - the cleanup after each case, which ends the holders and removes the folders with ten tries"
---

## Symptom

| Case | Run | What it said |
| --- | --- | --- |
| keeps a session's machine across a restart | 43044491680, `processes (1/2)`, main | `expected true to be false`, at the check that no `rm` was recorded |
| mounts the repository root for a session in a subfolder | 42727088464, `windows (2/4)`, main | `Test timed out in 20000ms`, after 24.6 s |
| takes the machine's own git volume with it | 44941762575, `windows (3/4)`, PR #426 | `ENOTEMPTY: directory not empty, rmdir` of `ahpd-disposable-*`, in the cleanup after the case |

## Cause

Unknown.
In the first case, the scripted Docker recorded an `rm` of the machine that the restarted daemon should hold for its session. The case waits for the log line that says the machine was found, and then for the delay to pass. The `rm` can come from the first daemon of the case, or from the second one before it adopts the machine.

In the third case, the cleanup removes the folder after it ends each holder, and with ten tries 100 ms apart. Something still writes into the folder after one second on a Windows runner.

## Impact

A CI job on main fails at random. If the first case shows a real race, a restart can remove the machine of a session that is still kept.

## Workaround

None. Running the job again is not a fix.

## Fix

- Record which daemon called `rm` in the first case, and when, against the line that says the machine is held.
- If the second daemon removes a machine before it adopts it, the fix is in the plugin, not in the case.
- Take the timings of the second case on a Windows runner.
- In the third case, name what writes into the folder after the holders end. It is the scripted Docker's state file, or a process that `endHolders` does not find.
- The second case was reported 4.6 s after its timeout, which says that a synchronous call blocked the event loop. Its own git setup now runs through `gitSync`, so a stall there fails at the call and names it.
