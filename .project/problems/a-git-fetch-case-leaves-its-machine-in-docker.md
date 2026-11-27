---
title: A git-fetch case that fails leaves its machine in Docker
status: open
date: 2026-11-27
severity: minor
refs:
  - "[code://packages/computer/test/computer-git-fetch.test.ts#L126-L128](../../packages/computer/test/computer-git-fetch.test.ts#L126-L128) - a case's `finally`, which removes the machine and ignores a refusal"
  - "[code://packages/computer/test/computer-git-fetch.test.ts#L237-L249](../../packages/computer/test/computer-git-fetch.test.ts#L237-L249) - `forceRemove`, which removes the container and its git volume as Docker does"
  - "[code://packages/computer/test/computer-far-git.test.ts#L137-L139](../../packages/computer/test/computer-far-git.test.ts#L137-L139) - the same `finally` in the far git cases"
  - git://447e5b204 - main when the leftovers were found
---

## Symptom

On 2026-11-27, the Docker on Softov's workstation held 17 containers named `ahpd-gitfetch-*` and `ahpd-fargit-*`, and 51 volumes named `ahpd-git-ahpd-gitfetch-*`.
They dated from 2026-10-07 to 2026-11-21.
Fifteen containers had exited with code 137, and two were still running.
No test was running.
All of them were removed on 2026-11-27.

## Cause

Most cases end with `await docker.remove(name).catch(() => {})`.
A removal that cannot bring the machine's work out keeps the machine, and the `catch` hides that.
So a case that fails before its work comes out leaves the container and its git volume.
A run that is stopped in the middle of a case skips the `finally`, and leaves them too.
Volumes outnumbered containers 51 to 17, so a volume can also outlive its container.

## Impact

Each failed or stopped run on a developer's machine leaves a container and a volume.
Nothing in a later run reads them, because each name carries the process id.
They use disk space and clutter `docker ps -a`.

## Workaround

Remove them by hand when no test runs: `docker rm -f` on `ahpd-gitfetch-*` and `ahpd-fargit-*`, then `docker volume rm` on `ahpd-git-ahpd-gitfetch-*` and `ahpd-git-ahpd-fargit-*`.

## Fix

- End every case with `forceRemove(name)` after `docker.remove`, so the container and its volume go whatever the removal answered.
- Remove, at the start of the file, the machines and volumes that the label marks and whose process is gone.
