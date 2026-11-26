---
title: ssh.machines is refused with its steps
status: todo
depends:
  - task-02-an-ssh-box-is-made-by-create.md
layer: "computer, server"
refs:
  - "[code://packages/computer/src/plugin.ts#L204](../../../../packages/computer/src/plugin.ts#L204) - `sshOptionsOf`, which stops reading `machines`"
  - "[code://packages/computer/src/ssh.ts#L140-L175](../../../../packages/computer/src/ssh.ts#L140-L175) - `machineOf` and `machinesOf`, which go"
  - "[code://packages/server/src/doctor.ts#L266-L312](../../../../packages/server/src/doctor.ts#L266-L312) - the Plugins check, which gains the option check"
  - "[code://packages/server/src/plugins.ts#L558-L564](../../../../packages/server/src/plugins.ts#L558-L564) - the manifest's `optionsSchema`, which the check compares against"
---

## Objective

The computer plugin no longer reads `ssh.machines`.
A config that still holds it loads, and the log and doctor say what to make instead.

## Files

- `UPDATE: packages/computer/src/plugin.ts:204` - stop reading `machines`, and log one line per entry with the connector and the create it needs.
- `DELETE: packages/computer/src/ssh.ts:140-175` - `machineOf` and `machinesOf`, which nothing calls once the option goes.
- `UPDATE: packages/computer/package.json:116-130` - remove `ssh.machines` from `optionsSchema`.
- `UPDATE: packages/server/src/doctor.ts:266-312` - warn for each top-level or nested option key that the plugin's `optionsSchema` does not declare.
- `UPDATE: packages/server/test/doctor.test.ts` - the doctor cases in *Validation*.
- `UPDATE: packages/computer/test/computer-ssh.test.ts` - replace the `ssh.machines` cases with the log line case.
- `UPDATE: packages/computer/test/computer-runtimes.test.ts` - make its ssh runtime from a connector and a record, not from `ssh.machines`.
- `UPDATE: packages/computer/test/computer-servercheck.test.ts` - reach its box through a connector.

## Steps

1. Log one line per entry: the connector fields, then the create body.
2. Keep every key path and secret out of that line.
3. Keep the plugin loading when the option is present, with every other option read as before.
4. Make the doctor check walk each plugin's options against its `optionsSchema`, and stop at keys the schema leaves open.
5. Give each undeclared key one `warn` line, `<plugin>: <path> is not an option`, with the fix line `remove it from the configuration`.
6. Move the `ssh.machines` test cases that still apply to the create cases of task 02, and delete the rest.

## Validation

- `packages/computer/test/computer-ssh.test.ts`: a config with `ssh.machines` loads, lists no ssh computer, and logs one line per entry without the `identity` path.
- `packages/server/test/doctor.test.ts`: an undeclared key warns; a key under an open `additionalProperties` does not.
- `pnpm test` passes.
- By hand: `ahpd doctor` with dev02's old entry prints the warning.

## Resume

