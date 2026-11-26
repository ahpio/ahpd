---
title: The shell is chosen in code
status: todo
depends: []
layer: "agent-cofold"
---

## Objective

`CofoldOptions.shell` names the program a shell call runs through. The shell language on a question and the `env` assignments follow that program.

## Files

- `UPDATE: packages/agent-cofold/src/agent.ts` - the `shell` option on `CofoldOptions`.
- `UPDATE: packages/agent-cofold/src/capabilities.ts` - `shellFamilyOf`, the shell built from the option, and the assignments by family.
- `UPDATE: packages/agent-cofold/src/tools.ts` - `confirmationOf` takes the language from its caller.
- `UPDATE: packages/agent-cofold/src/turns.ts` - pass the language of `options.shell` to `confirmationOf`.
- `UPDATE: packages/agent-cofold/src/turnagent.ts` - pass `options.shell` to `capabilitiesOf`.
- `UPDATE: packages/agent-cofold/src/plugin.ts` - `optionsOf` drops `shell`.
- `CREATE: packages/agent-cofold/test/agent-cofold-shell.test.ts` - the family, assignment and option cases.

## Steps

1. Add `shell?: ShellSpec` to `CofoldOptions`.
2. Write `shellFamilyOf(spec)`, which answers `powershell`, `bash`, `cmd` or `undefined` by the program's base name.
3. Build the shell capability with `shell({ shell })` when the option names a program.
4. Write the `env` assignments in the syntax of the family, with `set "NAME=value" &&` for cmd.
5. Give `confirmationOf` a `language` argument, and omit `shellLanguage` when the language is unknown.
6. Drop `shell` from the plugin's values in `optionsOf`.

## Validation

- `shellFamilyOf` answers each family for its programs, with or without `.exe`.
- A session with a `shell` option runs its calls through that program.
- A plugin value named `shell` does not reach the session.

## Resume
