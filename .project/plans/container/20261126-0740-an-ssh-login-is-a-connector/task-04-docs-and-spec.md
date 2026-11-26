---
title: Docs and spec
status: todo
depends:
  - task-03-ssh-machines-is-refused.md
layer: "docs"
refs:
  - "[code://docs/plugins/COMPUTERS.md#L327-L357](../../../../docs/plugins/COMPUTERS.md#L327-L357) - *ssh machines*, which is written again"
  - "[code://.project/specs/computers.md#L40](../../../specs/computers.md#L40) - the runtimes requirement"
  - "[code://.project/specs/computers.md#L71-L72](../../../specs/computers.md#L71-L72) - the scenario that lists the boxes in `ssh.machines`"
  - "[code://.project/specs/computers.md#L245-L246](../../../specs/computers.md#L245-L246) - the owner and meter rule for a runtime that only lists"
---

## Objective

The docs and the computers spec say what this plan built, and the release notes say what an upgrade needs.

## Files

- `UPDATE: docs/plugins/COMPUTERS.md:327-357` - replace *ssh machines* with the ssh connector, its three logins, the create body, and the profile `server`.
- `UPDATE: .project/specs/computers.md:71-72` - an ssh computer is made by create with a connector, and a remove forgets it.
- `UPDATE: .project/specs/computers.md:245-246` - an ssh computer is owned and charged like every other computer.
- `UPDATE: docs/updates/v0_15.md` - say that `ssh.machines` is no longer read, and how to make the connector and the computer.

## Steps

1. Write the connector section with one example for each `auth` value.
2. Write the create body with dev02 as the example, using `example.com` for every address.
3. Say that each connector with a vault key has its own `ssh-agent`, and what `ssh.vaultKey: file` changes.
4. Say how the plugin accepts, pins and clears a host key.
5. Correct the spec scenarios in place.
6. Run `lint-prose` on every file this task changes.

## Validation

- `node ~/.claude/skills/do-spec/scripts/lint-prose.mjs .project/specs/computers.md` passes.
- No real address is in the changed files: `rg -n "@" docs/plugins/COMPUTERS.md` shows only `example.com`.

## Resume

