---
title: A dev container stop case reads the container running after the stop
status: open
date: 2026-11-14
severity: minor
blocks: []
refs:
  - "[code://packages/computer/test/computer-devcontainer.test.ts#L2174-L2207](../../packages/computer/test/computer-devcontainer.test.ts#L2174-L2207) - \"leaves the folder's container alone while a session of this host is running in it\""
  - "[code://packages/sdk/src/host/vscodemethods.ts#L331-L347](../../packages/sdk/src/host/vscodemethods.ts#L331-L347) - `devContainerStopped`, which answers with the launcher's own stop"
  - git://93b232b89 - the head of #337, where the case failed
---

## Symptom

In run 43652823221 of #337, `windows (1/4)` failed the case "leaves the folder's container alone while a session of this host is running in it".
The stop after `disposeSession` answered `true`, and the scripted Docker still held the machine as `running`, where the case expects `exited`.
It passed on Linux in the same run, and in the local computer suite.
No failed CI run since 2026-11-08 has this case.

## Cause

Unknown. The case waits only until the scripted Docker's lock file is gone, and then stops the container.
A Docker call from the session's disposal that comes after the stop could write the machine back as `running`. Nobody has checked this.
#337 changes how a turn end settles an automation run, and the case runs no turn.

## Impact

A Windows CI job can fail at random, and block a merge until it runs again.

## Workaround

None. Running the job again is not a fix.

## Fix

- Find which Docker call writes the machine after the stop, and make the case wait for the disposal to end before it stops the container.
