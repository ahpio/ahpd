---
title: A dev container starts from an image - implemented
date: 2026-11-22
refs:
  - git://32adb4fe1
  - "[code://packages/computer/src/environments.ts](../../../../packages/computer/src/environments.ts)"
  - "[code://packages/computer/src/devcontainer.ts](../../../../packages/computer/src/devcontainer.ts)"
  - "[code://packages/sdk/src/host/vscodemethods.ts](../../../../packages/sdk/src/host/vscodemethods.ts)"
---

A client can now start a dev container from an allowed image instead of a workspace folder: the workspace lives in a Docker volume this host names and labels, the container is made by the Dev Container CLI from the image, and a host is relayed inside it as a folder's connect does. The same client can remove the environment afterwards, taking its container, its workspace volume and its state volume with it, and a stopped container is no longer started until the client says `resume`.

## What was built

- [`code://packages/computer/src/environments.ts`](../../../../packages/computer/src/environments.ts) - the environment volume, its labels, the state volume's computed name, the image's configuration in an owner-only cache folder, the stopped-container refusal, and the removal of the containers, the labelled volumes and a state volume found by its name and identity.
- [`code://packages/computer/src/devcontainer.ts`](../../../../packages/computer/src/devcontainer.ts) - `connectEnvironment` and `removeEnvironment` on the launcher, the owner each environment was made by, the removed environments whose ids are not used again, and the relays a removal closes.
- [`code://packages/sdk/src/types/containers.ts`](../../../../packages/sdk/src/types/containers.ts) - `resume` on both connects and `removeEnvironment` on the port.
- [`code://packages/sdk/src/host/vscodemethods.ts`](../../../../packages/sdk/src/host/vscodemethods.ts) - `vscode/devContainers/connectEnvironment` and `vscode/devContainers/removeEnvironment`, with `resume` read on both connects and the owner taken from the connection.
- [`code://packages/sdk/src/host/gate.ts`](../../../../packages/sdk/src/host/gate.ts) and [`code://packages/sdk/src/host/handshake.ts`](../../../../packages/sdk/src/host/handshake.ts) - `container:connect` and `container:remove` for the methods, and `vscode.devContainerEnvironments` in `_meta` while containers are ready.

## Verified

- `pnpm typecheck` passed.
- `pnpm boundary` passed, every package with no undeclared dependency.
- The tests were written and not run here, because the owner runs every suite: `packages/computer/test/environments.test.ts` holds eleven cases (the first free volume, a reused one, a skipped state name, the id and image refusals, a stopped container with and without `resume`, the removal of containers and volumes and the cache folder, another dev container's state volume kept, the relay, the removal with a relay open, another principal's refusal, and a failed removal that leaves the environment connectable); `packages/computer/test/devcontainer.test.ts` now proves a stopped folder container is refused without `resume` and started with it.

## Departures from the plan

- Task 02 step 1 says a source is marked suspended on `stop`. No mark is kept: the launcher reads the container's own state, from the plugin's `existing` answer for a folder and from `docker ps -a` for an environment. The plugin replaces the port's `stop` and `remove` with its own (`packages/computer/src/plugin.ts`), which is not one of the task's files, so a mark set inside the launcher's `stop` would never be added; the runtime's state is the same fact whichever road stopped the container.
- Ownership is in memory and first connect wins: an environment this daemon did not see made has no recorded owner and a removal of it is not refused for want of a record. A daemon restart forgets the owners, as VS Code's own in-memory sets are forgotten.
- The plan pinned the stopped and deleted sentences and not the one for another principal's environment; the launcher answers `Dev Container environment '<id>' was made by another user.`
- Containers are removed one `docker rm --force` at a time rather than in one command, because a removal closes every relay before the first removal and each container is named by its own id.
- The environment's configuration is kept under the system temporary directory, in a per-user folder, overridable by the launcher's `environmentCache` option; the plan did not name the folder.
- Two test files outside the task's list were changed: `packages/computer/test/devcontainer.test.ts`, whose stopped-container case now asks to resume, and the scripted `packages/computer/test/fixtures/docker.mjs`, which now answers `ps --quiet` with container ids.

## Left for later

- `devContainers/sandboxSupport` and `devContainers/userState` from the brief are not served.
- [briefs/vscode-methods-ahpd-does-not-serve.md](../../../briefs/vscode-methods-ahpd-does-not-serve.md) still lists the environment methods as unserved; it was not in the plan's scope.
- An environment's container is not registered as a machine of the computer runtime, so a removal acts on Docker alone and there is no `computers.json` record to close.
