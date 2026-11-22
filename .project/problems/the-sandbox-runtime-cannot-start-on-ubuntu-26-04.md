---
title: The sandbox runtime cannot start a command on Ubuntu 26.04
status: open
date: 2026-11-22
severity: major
refs:
  - "[code://packages/computer/test/sandbox-runtime-fork.test.ts](../../packages/computer/test/sandbox-runtime-fork.test.ts) - the cases that failed on 26.04"
  - "[code://.github/workflows/ci.yml](../../.github/workflows/ci.yml) - the `processes` job, pinned to `ubuntu-24.04` for it"
  - https://github.com/ahpio/ahpd/actions/runs/45051177576 - the first run that failed, on the `ubuntu-26.04` image
---

## Symptom

On GitHub's `ubuntu-26.04` image, a command that `@ahpio/sandbox-runtime@0.0.83-rc.0` starts prints this and exits 1:

```
apply-seccomp: write /proc/self/setgroups (nested userns is capability-restricted; caller must provide CAP_SYS_ADMIN): Permission denied
```

The job had run `sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` and `kernel.unprivileged_userns_clone=1`. `bwrap --unshare-pid --unshare-user --cap-drop ALL --ro-bind / / --proc /proc true` passed in the same job. The same cases pass on Debian 13 and on `ubuntu-24.04`.

## Cause

Unknown. The runtime's seccomp helper runs inside bubblewrap and makes a nested user namespace, and 26.04 refuses it to write `setgroups`. The helper runs while a chat's settings block Unix sockets, which ahpd's settings always do.

## Impact

A host on Ubuntu 26.04 cannot run a chat's sandboxed commands. ahpd's CI runs the runtime's cases on 24.04 only.

## Workaround

None for a host. CI's `processes` job runs on `ubuntu-24.04`, as the runtime's own CI does.

## Fix

Not decided. It may be the runtime's to fix upstream, or a setting that 26.04 needs.
