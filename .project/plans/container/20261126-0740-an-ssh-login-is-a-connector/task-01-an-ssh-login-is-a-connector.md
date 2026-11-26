---
title: An ssh login is a connector
status: todo
depends: []
layer: "computer"
refs:
  - "[code://packages/agent-claude/src/adapter.ts#L135](../../../../packages/agent-claude/src/adapter.ts#L135) - the sibling adapter: a schema with a secret field, `open`, `check`"
  - "[code://packages/sdk/src/types/connectors.ts#L431-L506](../../../../packages/sdk/src/types/connectors.ts#L431-L506) - `Adapter`, which this task implements"
  - "[code://packages/computer/src/ssh.ts#L346-L365](../../../../packages/computer/src/ssh.ts#L346-L365) - `sshReach`, which takes the login from the connector"
---

## Objective

`@ahpd/computer` registers an `ssh` adapter.
A connector of it holds one login, and its check says whether that login reaches the box.

## Files

- `CREATE: packages/computer/src/login.ts` - the `ssh` adapter, the map of open logins, the per-connector `ssh-agent` and key file, the per-connector known-hosts file.
- `UPDATE: packages/computer/src/ssh.ts:64-100` - split `SshMachine` into `SshLogin` (destination, port, jump, auth, identity, hostKey) and the computer fields.
- `UPDATE: packages/computer/src/ssh.ts:346-365` - build the argv from an `SshLogin`: `-i` for `file`, `SSH_AUTH_SOCK` or `-i` for `vault`, the connector's known-hosts file.
- `UPDATE: packages/computer/src/plugin.ts` - call `host.registerAdapter` with the `ssh` adapter, and read the `ssh.vaultKey` setting.
- `UPDATE: packages/computer/package.json` - add `ssh.vaultKey`, `agent` or `file`, default `agent`.
- `CREATE: packages/computer/test/login.test.ts` - the adapter cases in *Validation*.

## Steps

1. Check on Windows whether `ssh-agent -a <pipe>` and `ssh-add -` run under the daemon's user, and write the result in *Resume*.
2. Write the adapter schema: `destination` required, `port`, `jump`, `auth` as `agent`, `file` or `vault`, `identity` path, `key` marked `secret`, `hostKey`.
3. Refuse `auth: file` with no `identity`, and `auth: vault` with no `key`, and name the field.
4. For a `vault` login, start an `ssh-agent` in `open`, on a socket in the plugin's folder.
5. Load the key into that agent with `ssh-add -` on stdin.
6. Under `ssh.vaultKey: file`, write the key to a 0600 file in the plugin's folder instead.
7. Where step 1 found no agent, refuse a `vault` login with a sentence that names `ssh.vaultKey: file`.
8. Stop the agent, or remove the file, in the stop that `open` returns.
9. Give each connector its own known-hosts file, with `StrictHostKeyChecking=accept-new`, as VM machines have today.
10. Put the connector's `hostKey` into its known-hosts file before the first reach.
11. Write `check` as one `ssh ... true`: `ok` when it answers, `denied` on an authentication failure, `unreachable` on a timeout, `failed` otherwise.
12. Put the accepted host key's fingerprint in the `ok` message, and the ssh line in every other message.
13. Pass the agent's `SSH_AUTH_SOCK` to every ssh process of that login, including `-J` and `DOCKER_HOST=ssh://`.

## Validation

- `packages/computer/test/login.test.ts`: each `auth` value builds its own argv.
- The same file: a `vault` login starts one agent and stops it on close.
- The same file: `ssh.vaultKey: file` writes a 0600 file and removes it on close.
- The same file: two `vault` connectors hold two agents, and each argv names its own socket.
- The same file: a changed host key gets a refusal sentence, and a `hostKey` pins the first reach.
- `pnpm --filter @ahpd/computer test` passes.
- By hand: a connector for dev02 answers `ok` with `agent`, with `file` and with `vault`.

## Resume

