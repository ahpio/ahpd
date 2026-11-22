---
title: The sandbox runtime cannot start a command on Ubuntu 26.04
status: open
date: 2026-11-22
severity: major
refs:
  - "[code://packages/computer/test/sandbox-runtime-fork.test.ts](../../packages/computer/test/sandbox-runtime-fork.test.ts) - the cases that failed on 26.04"
  - "[code://.github/workflows/ci.yml](../../.github/workflows/ci.yml) - the `processes` job, pinned to `ubuntu-24.04` for it"
  - https://github.com/ahpio/ahpd/actions/runs/45051177576 - the first run that failed, on the `ubuntu-26.04` image
  - "[code://packages/computer/src/sandbox.ts#L291-L302](../../packages/computer/src/sandbox.ts#L291-L302) - `hostSandboxRefusal`, which runs bubblewrap and not the runtime"
  - https://github.com/anthropics/claude-code/issues/87680 - the profile's rules, and the denial of `sys_admin`
  - https://github.com/anthropics/claude-code/issues/101946 - the same error on 26.04, with the sysctl set
  - https://github.com/nathapp-io/nax/pull/2868 - CI on `ubuntu-latest` with the profile unloaded
---

## Symptom

On GitHub's `ubuntu-26.04` image, a command that `@ahpio/sandbox-runtime@0.0.83-rc.0` starts prints this and exits 1:

```
apply-seccomp: write /proc/self/setgroups (nested userns is capability-restricted; caller must provide CAP_SYS_ADMIN): Permission denied
```

The job had run `sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` and `kernel.unprivileged_userns_clone=1`. `bwrap --unshare-pid --unshare-user --cap-drop ALL --ro-bind / / --proc /proc true` passed in the same job. The same cases pass on Debian 13 and on `ubuntu-24.04`.

## Cause

Ubuntu 26.04 loads the AppArmor profile `bwrap-userns-restrict`, which attaches to `/usr/bin/bwrap`. Its child profile `unpriv_bwrap` has `audit deny capability,`, so no program inside bubblewrap holds a capability.
The runtime's seccomp helper makes a nested user namespace inside bubblewrap, and needs `CAP_SYS_ADMIN` to write `setgroups`. The helper runs while a chat's settings block Unix sockets, which ahpd's settings always do.
The sysctl does not lift a profile that attaches to a binary, and `enableWeakerNestedSandbox` changes only the error. No upstream release fixes it: every runtime from 0.0.70 to 0.0.83 has the same helper.
`hostSandboxRefusal` runs bubblewrap without the helper, so a 26.04 host passes the check and then fails every command.

## Impact

A host on Ubuntu 26.04 cannot run a chat's sandboxed commands, and is not told why. ahpd's CI runs the runtime's cases on 24.04 only.

## Workaround

An admin unloads the profile: `sudo apparmor_parser -R /etc/apparmor.d/bwrap-userns-restrict`, with a link in `/etc/apparmor.d/disable/` to keep it off. CI's `processes` job runs on `ubuntu-24.04`, as the runtime's own CI does.

## Fix

Softov, 2026-11-22, "Refuse clearly, name the fix (Recommended)": the host check runs a command through the runtime, as `MACHINE_SANDBOX_CHECK` does in a machine. A host that fails it says the sandbox cannot run, and names the profile and the command that unloads it. CI unloads the profile and goes back to `ubuntu-latest`. No plan is written yet.
