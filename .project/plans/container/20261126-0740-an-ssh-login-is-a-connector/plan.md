---
title: An ssh login is a connector, and an ssh box is a computer made by create
domain: container
status: built
priority: high
created: 2026-11-26
revalidated: 2026-11-26
changes:
  - specs/computers.md
refs:
  - git://c53264d14 - main when the facts were checked
  - "[code://packages/computer/package.json#L108-L130](../../../../packages/computer/package.json#L108-L130) - the `ssh` option and `ssh.machines`, which this plan removes"
  - "[code://packages/computer/src/ssh.ts#L64-L100](../../../../packages/computer/src/ssh.ts#L64-L100) - `SshMachine` and `SshOptions`: login facts and computer facts in one record"
  - "[code://packages/computer/src/ssh.ts#L140-L175](../../../../packages/computer/src/ssh.ts#L140-L175) - `machineOf` and `machinesOf`, which read the boxes from the options"
  - "[code://packages/computer/src/ssh.ts#L346-L365](../../../../packages/computer/src/ssh.ts#L346-L365) - `sshReach`, the one argv every ssh verb uses: `BatchMode`, the known-hosts file, `-J`, `-p`, `-i`"
  - "[code://packages/computer/src/ssh.ts#L457-L470](../../../../packages/computer/src/ssh.ts#L457-L470) - `sshRuntime`, whose machine map is fixed when the plugin loads"
  - "[code://packages/computer/src/ssh.ts#L652-L665](../../../../packages/computer/src/ssh.ts#L652-L665) - the verbs that make a machine, all refused today"
  - "[code://packages/computer/src/plugin.ts#L204](../../../../packages/computer/src/plugin.ts#L204) - `sshOptionsOf`, the read of the `ssh` option"
  - "[code://packages/computer/src/plugin.ts#L472-L497](../../../../packages/computer/src/plugin.ts#L472-L497) - a profile's `server` checked against `ssh.machines`"
  - "[code://packages/computer/src/plugin.ts#L700-L747](../../../../packages/computer/src/plugin.ts#L700-L747) - VM and Docker profiles that refuse a server with an `identity`, because `ssh -J` and `DOCKER_HOST` take no key file"
  - "[code://packages/computer/src/owners.ts#L35](../../../../packages/computer/src/owners.ts#L35) - `computers.json`, the file that holds the halves of a machine that live beside the config"
  - "[code://packages/computer/src/router.ts#L30-L42](../../../../packages/computer/src/router.ts#L30-L42) - `spellMachineId` and `parseMachineId`: an ssh machine stays `ssh.<name>`"
  - "[code://packages/computer/src/provider.ts#L297](../../../../packages/computer/src/provider.ts#L297) - `create`, the path an ssh computer is now made through"
  - "[code://packages/sdk/src/types/connectors.ts#L70](../../../../packages/sdk/src/types/connectors.ts#L70) - `ConnectorOwner`: host, team or user"
  - "[code://packages/sdk/src/types/connectors.ts#L220-L233](../../../../packages/sdk/src/types/connectors.ts#L220-L233) - `Connector`, with each secret read back from the vault"
  - "[code://packages/sdk/src/types/connectors.ts#L431-L506](../../../../packages/sdk/src/types/connectors.ts#L431-L506) - `Adapter`: `schema`, `open`, `check`; only the plugin that registers an adapter sees its connectors"
  - "[code://packages/agent-claude/src/adapter.ts#L135](../../../../packages/agent-claude/src/adapter.ts#L135) - `loginAdapter`, the sibling adapter this one copies: a secret field, `open`, `check`"
  - "[code://packages/server/src/doctor.ts#L266-L312](../../../../packages/server/src/doctor.ts#L266-L312) - the Plugins check, which reads no plugin options today"
  - "[code://packages/server/src/plugins.ts#L558-L564](../../../../packages/server/src/plugins.ts#L558-L564) - a plugin manifest's `optionsSchema`, which the doctor check reads"
  - "[code://docs/plugins/COMPUTERS.md#L327-L357](../../../../docs/plugins/COMPUTERS.md#L327-L357) - *ssh machines* in the docs"
  - "[code://.project/plans/container/05-p9-an-ssh-machine-runs-a-nested-host/plan.md](../05-p9-an-ssh-machine-runs-a-nested-host/plan.md) - the plan that put ssh boxes in the options, as a first step with a box made by hand"
  - "[code://.project/plans/container/05-p8-a-profile-on-another-docker/plan.md](../05-p8-a-profile-on-another-docker/plan.md) - the plan that made `ssh.machines` the list a profile names its `server` from"
  - https://github.com/microsoft/vscode/blob/ce997d62c79464a0c070c3d2654198f0391e1809/src/vs/platform/agentHost/common/sshRemoteAgentHost.ts#L37-L69 - VS Code's ssh host record: host, port, user, and `agent`, `keyFile` or `password` as the auth method
  - https://github.com/microsoft/vscode/blob/ce997d62c79464a0c070c3d2654198f0391e1809/src/vs/platform/agentHost/common/sshHostKeyPolicy.ts - VS Code refuses a changed host key until the person forgets the host
  - https://man.openbsd.org/ssh-agent - `ssh-agent -a <socket>` binds an agent to one socket, and `SSH_AUTH_SOCK` names it
  - https://man.openbsd.org/ssh-add - `ssh-add -` reads a key from standard input
---

## Goal

An ssh box is a computer like any other, made with a create and owned by the person who made it.
How ahpd logs in to a box is an ssh connector.
A person, a team or the host owns the connector, and its key can be in the vault.
Today one host option, `ssh.machines`, holds both the login and the computer.
Only the operator can write that option, and every box belongs to the host with one shared login.
This plan removes the option.
Then a person can add a box from a client, and each box can have its own login.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "ssh\.machines|sshOptionsOf|machinesOf" packages/computer/src` - the option is read once at load, in `plugin.ts`, and passed to `sshRuntime` and to the profile checks.
- `rg "registerAdapter" packages/*/src` - adapters in `agent-claude`, `activepieces`, `webhook` and `tunnel-devtunnel`; none in `computer`.
- `rg "x-ahpd/connectors/put|putConnector" packages/sdk/src` - a connector is made only by a client's `x-ahpd/connectors/put`; no plugin API makes one.
- `rg "optionsSchema" packages/server/src/doctor.ts` - nothing: doctor never compares a plugin's options to its schema.
- `rg -i "ssh" .project/decisions` - no decision holds the options shape.
  It is a row in p9: "An ssh machine's records are the plugin's options, not labels on the box".

### Runtime path

```
client form -> x-ahpd/connectors/put (adapter ssh) -> Adapter.open -> logins map in @ahpd/computer
                                                    -> Adapter.check -> ssh true -> ok | denied | unreachable, host key pinned
client create { runtime: ssh, connector, workdir, host, agents } -> provider.create -> computers.json entry -> computer://ssh.<name>
session in computer://ssh.<name> -> sshReach(login of its connector) -> ssh -T ... -> ahpd --stdio on the box
profile { server: <connector id> } -> the VMs or the Docker reached through that login
```

### Gaps

- `@ahpd/computer` registers no adapter, so a login cannot be a connector today.
- `sshRuntime` takes a fixed machine map, so a box added after load is not listed.
- The ssh runtime refuses `run` and `remove`, so a box cannot be added or forgotten with a create.
- A vault key cannot reach `ssh`: OpenSSH reads a key from a file or an agent only.
- `ssh -J` and `DOCKER_HOST=ssh://` take no key file, so a VM or Docker server with its own key is refused today.
- Doctor does not say when a plugin's options hold a key its schema no longer declares.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The ssh connector is inside `@ahpd/computer`, not a plugin of its own | Softov, 2026-11-26: "anyway we need a connector for ssh inside computer" | 01 |
| The connector holds the login only: destination, port, jump host, how it logs in, host key | Softov, 2026-11-26, on the split: "doe not make sense"; then "plan it" | 01 |
| An ssh box is a computer made by create, with `runtime: ssh`, naming a connector, with its `workdir`, `host` and `agents` | Softov, 2026-11-26: "why you implemented that way? not as a computer with a runtime?"; then "plan it" | 02 |
| A create on ssh makes nothing on the box, and a remove forgets the box and leaves it as it is | the box is not this host's to make or remove, as [`code://packages/computer/src/ssh.ts#L652-L665`](../../../../packages/computer/src/ssh.ts#L652-L665) says today | 02 |
| An ssh computer's record is an entry in `computers.json` | `computers.json` already holds the halves of a machine that live beside the config, [`code://packages/computer/src/owners.ts#L35`](../../../../packages/computer/src/owners.ts#L35) | 02 |
| A profile's `server` names an ssh connector of the host | (defaulted: profiles are host config, and their machines are charged to the host) | 02 |
| Each connector picks how it logs in: `agent` (the daemon user's own ssh), `file` (a key path) or `vault` (the key in the vault) | Softov, 2026-11-26: "Yes, plan it so" | 01 |
| A `vault` key goes into an `ssh-agent` of that connector's own, and a plugin setting `ssh.vaultKey: file` writes a 0600 file instead | Softov, 2026-11-26: "Yes, plan it so"; he asked "for multiple servers I will need multiple logins, so ssh-agent will work? can be configurable?" | 01 |
| A first host key is accepted into the connector's own known-hosts file and refused when it changes; an optional `hostKey` field pins it from the start | Softov, 2026-11-26: "Accept once, pin it" | 01 |
| `ssh.machines` is no longer read; each entry gives one log line with the connector and the computer to make | Softov, 2026-11-26: "Refuse with the steps" | 03 |
| Doctor warns about any option key that a plugin's `optionsSchema` does not declare | (defaulted: the answer named doctor, and a check by plugin name would tie the server to one plugin) | 03 |
| A person may make an ssh computer with a connector they own, their team owns, or the host owns | (defaulted: the same owners a connector takes, [`code://packages/sdk/src/types/connectors.ts#L70`](../../../../packages/sdk/src/types/connectors.ts#L70)) | 02 |
| The computer is owned by the person who made it, and its up time is charged to that owner | (defaulted: the owner rule every other computer has, `specs/computers.md` *A machine is owned and metered*) | 02 |
| A password login is not offered | (defaulted: every ssh call runs with `BatchMode=yes`, [`code://packages/computer/src/ssh.ts#L354`](../../../../packages/computer/src/ssh.ts#L354)) | 01 |

## Proposed architecture

- **Data flow** - A client puts an `ssh` connector, and the host calls `open`. The plugin keeps the login in a map by connector id. A create names that id, and the plugin writes the computer into `computers.json`. Every reach builds its argv from the login and the computer.
- **Event flow** - `open` adds a login, and its stop removes it. A create adds a computer, and a remove forgets it. Each change updates the `x-ahpd-computers://` channel, as a listing does today.
- **State flow** - The login is the connector record, with the key in the vault. The computer is its `computers.json` entry. A `vault` login holds one `ssh-agent` process while the connector is open, or one 0600 file under `ssh.vaultKey: file`. Each connector has one known-hosts file in the plugin's folder.
- **Layer responsibilities** - `@ahpd/computer`: the adapter, the logins, the ssh computers, the refusal of `ssh.machines` · `@ahpd/server`: the doctor check on undeclared option keys · `@ahpd/sdk`: nothing changes.
- **Source-of-truth files** - [`code://packages/computer/src/ssh.ts`](../../../../packages/computer/src/ssh.ts), [`code://packages/computer/src/owners.ts`](../../../../packages/computer/src/owners.ts), [`code://packages/computer/package.json`](../../../../packages/computer/package.json)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - an ssh login is a connector](task-01-an-ssh-login-is-a-connector.md) | done | - |
| [02 - an ssh box is made by create](task-02-an-ssh-box-is-made-by-create.md) | done | 01 |
| [03 - ssh.machines is refused with its steps](task-03-ssh-machines-is-refused.md) | done | 02 |
| [04 - docs and spec](task-04-docs-and-spec.md) | done | 03 |

## Risks and tradeoffs

- On upgrade, the boxes in `ssh.machines` and the profiles that name them stop working - the log line and doctor say what to make.
- Windows OpenSSH may not let ahpd start its own `ssh-agent` - task 01 checks it first. Where it cannot, a `vault` login refuses and names `ssh.vaultKey: file`.
- An `ssh-agent` per open connector is one process each - it holds one key and stops when the connector closes.
- A first host key is trusted when nobody pasted one - the check prints the fingerprint it accepted. A changed key stays refused until the person clears the pin.

## Resume state

- **Done so far:** tasks 01 to 04, 2026-11-26; see [implemented.md](implemented.md).
- **Next action:** the checks by hand on dev02, in [deferred.md](deferred.md).
- **Open questions:** none.
- **Watch out for:** only the plugin that registers an adapter sees its connectors. So the logins stay inside `@ahpd/computer`, with no SDK port for them. A connector's secret reaches `open` and `check` as the value, never as a reference.

## Final verification checklist

- [ ] An `ssh` connector made from a client form answers `ok` for dev02 with each of `agent`, `file` and `vault`.
- [ ] Two connectors to two boxes, each with its own vault key, reach each box with its own key only.
- [ ] A create with `runtime: ssh` lists `computer://ssh.<name>`, a session runs there, and a remove leaves the box untouched.
- [ ] A VM profile whose `server` names a `vault` connector makes a VM through `ssh -J`.
- [ ] A config that still holds `ssh.machines` loads, logs one line per entry, and doctor warns.
- [ ] `pnpm test` passes, and check-windows is green.
