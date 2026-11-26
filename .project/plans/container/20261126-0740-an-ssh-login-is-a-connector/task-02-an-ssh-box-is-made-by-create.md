---
title: An ssh box is made by create
status: done
depends:
  - task-01-an-ssh-login-is-a-connector.md
layer: "computer"
refs:
  - "[code://packages/computer/src/provider.ts#L297](../../../../packages/computer/src/provider.ts#L297) - `create`, which an ssh computer now goes through"
  - "[code://packages/computer/src/owners.ts#L35](../../../../packages/computer/src/owners.ts#L35) - `computers.json`, where the computer's record is kept"
  - "[code://packages/computer/src/ssh.ts#L457-L470](../../../../packages/computer/src/ssh.ts#L457-L470) - `sshRuntime`, whose fixed machine map becomes the records"
  - "[code://packages/computer/src/plugin.ts#L700-L747](../../../../packages/computer/src/plugin.ts#L700-L747) - the profile `server` checks that move to connectors"
---

## Objective

A create with `runtime: ssh` and a connector adds a box as `computer://ssh.<name>`, and a remove forgets it.
A profile's `server` names an ssh connector of the host.

## Files

- `UPDATE: packages/computer/src/ssh.ts:457-470` - list the ssh computers from `computers.json` at each call, not from a map fixed at load.
- `UPDATE: packages/computer/src/ssh.ts:652-665` - `run` records the box, and `remove` forgets it; `start`, `stop` and `restart` stay refused.
- `UPDATE: packages/computer/src/owners.ts` - hold an ssh computer's `connector`, `workdir`, `host` and `agents` in its entry.
- `UPDATE: packages/computer/src/provider.ts:297` - take `connector`, `workdir`, `host` and `agents` in a create body for `runtime: ssh`.
- `UPDATE: packages/computer/src/plugin.ts:472-497` - check a profile's `server` against the host's ssh connectors.
- `UPDATE: packages/computer/src/plugin.ts:700-747` - reach a VM or Docker server through its connector's login, and remove the refusals of a server with a key.
- `CREATE: packages/computer/test/ssh-create.test.ts` - the cases in *Validation*.

## Steps

1. Add the ssh fields to the create body schema that `describe` sends.
2. Refuse a create whose connector is not open, and name the connector.
3. Refuse a create whose connector belongs to another user or another team.
4. Run the server check once through the connector before you write the record.
5. Refuse the create when the server check fails.
6. Write the entry into `computers.json` with the creator as owner, and answer `computer://ssh.<name>`.
7. Make `remove` delete the entry only, and say in its answer that the box was not changed.
8. Give an entry the status `unreachable: the login <id> is not open` while its connector is not open.
9. Read a profile's `server` as the id of a host-owned ssh connector.
10. Leave out a profile whose `server` names any other connector, and log one line.
11. Pass the login's `SSH_AUTH_SOCK` or key file to the `-J` and `DOCKER_HOST` reach of a profile server.

## Validation

- `packages/computer/test/ssh-create.test.ts`: a create lists the box; a remove forgets it and runs no command on it.
- The same file: another user's connector gets a refusal, and the host's connector works for every user.
- The same file: a box whose connector closes lists as unreachable, and lists as running again when it opens.
- The same file: a VM profile whose `server` names a `vault` connector builds a `-J` reach with that connector's socket.
- `pnpm --filter @ahpd/computer test` passes.
- By hand: create `ssh.dev02` from ahpw and run a session there.
- By hand: remove `ssh.dev02`, and check that the box did not change.

## Resume

