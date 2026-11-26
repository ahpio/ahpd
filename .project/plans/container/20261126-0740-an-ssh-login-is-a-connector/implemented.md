---
title: An ssh login is a connector, and an ssh box is a computer made by create - implemented
date: 2026-11-26
refs:
  - git://73198982d - the plan commit this build starts from
  - "[code://packages/computer/src/login.ts](../../../../packages/computer/src/login.ts)"
  - "[code://packages/computer/src/ssh.ts](../../../../packages/computer/src/ssh.ts)"
  - "[code://packages/computer/src/plugin.ts](../../../../packages/computer/src/plugin.ts)"
---

An ssh login is now a connector of the computer plugin's `ssh` adapter.
A person, a team or the host owns it, and its key can be in the vault.
An ssh box is a computer made by a create with `"runtime": "ssh"` that names the login.
A remove forgets the box.
`ssh.machines` is no longer read: each old entry gives one log line, and `ahpd doctor` warns.

## What was built

| File | What it holds |
| --- | --- |
| [`code://packages/computer/src/login.ts`](../../../../packages/computer/src/login.ts) | The `ssh` adapter, its three ways to log in, the vault agent, the pinned host key and the check. |
| [`code://packages/computer/src/ssh.ts`](../../../../packages/computer/src/ssh.ts) | The runtime, which reads its boxes from records and logins at each call. |
| [`code://packages/computer/src/owners.ts`](../../../../packages/computer/src/owners.ts) | An ssh box's record in `computers.json`. |
| [`code://packages/computer/src/manifest.ts`](../../../../packages/computer/src/manifest.ts) | The create body for `runtime: ssh`, and the runtime choice in the form. |
| [`code://packages/computer/src/plugin.ts`](../../../../packages/computer/src/plugin.ts) | The adapter, the boxes, the profile servers and the `ssh.machines` log lines. |
| [`code://packages/computer/src/libvirt.ts`](../../../../packages/computer/src/libvirt.ts) | `virsh` with the server login's agent. |
| [`code://packages/computer/src/vm.ts`](../../../../packages/computer/src/vm.ts) | The VM jump with the server login's agent. |
| [`code://packages/server/src/doctor.ts`](../../../../packages/server/src/doctor.ts) | A warning for each option key that a plugin's `optionsSchema` does not name. |
| [`code://docs/plugins/COMPUTERS.md`](../../../../docs/plugins/COMPUTERS.md) | The docs of the login and the create. |
| [`code://docs/updates/v0_16.md`](../../../../docs/updates/v0_16.md) | The upgrade note. |

## Verified

- `packages/computer/test/login.test.ts` has 14 cases.
  They cover two vault logins with two agents, the pinned public key, a refused `-oProxyCommand=` destination and the check.
- `packages/computer/test/computer-ssh.test.ts` covers a create, a remove that runs nothing on the box, and the owner rule.
- `packages/computer/test/computer-libvirt.test.ts` covers a VM reached with the agent of its server's login.
- `packages/computer/test/computer-far-docker.test.ts` covers a server login with a key file, and one that is not open.
- `packages/server/test/doctor.test.ts` covers an undeclared key, and a key under an open map.
- `pnpm typecheck`, `pnpm boundary`, `pnpm sdk-range`, `pnpm i18n`, `pnpm build` and `pnpm test` pass.
- The checks by hand on dev02 wait in [`.project/pending/ssh-logins-on-dev02.md`](../../../pending/ssh-logins-on-dev02.md).

## Departures from the plan

| Task | What was done instead | Why |
| --- | --- | --- |
| 01, step 1 | A `vault` login with `ssh.vaultKey: agent` is refused on Windows by platform. | No Windows box was at hand. |
| 01 | The vault agent's public key is named with `-i` and `IdentitiesOnly=yes`. | The daemon user's default keys are never offered for a vault login. |
| 01 | On a host with users, a person's or a team's login uses `vault` only. | `agent` and `file` use the daemon user's own keys. |
| 01 | A destination, a jump host or a port that is not one plain word is refused. | A value that starts with `-` reaches `ssh` as an option, such as `-oProxyCommand=`. |
| 02 | A create checks the box with one `ssh ... true`, not the server check. | A box with no Docker or libvirt is still a computer. |
| 02 | A server whose Docker is the plugin's own `DOCKER_HOST` gets a runner of its own. | The server's address comes from its login, which opens after load. |
| 04 | The upgrade note is in `docs/updates/v0_16.md`. | 0.15 is out, and 0.16 is not. |

## Left for later

- See [deferred.md](deferred.md).
