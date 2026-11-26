---
title: Cofold cases run their shell calls through a fast shell
domain: cofold
status: active
priority: high
created: 2026-11-26
revalidated: 2026-11-26
refs:
  - git://aa3a8a114 - main when the plan was made, and the last commit that holds the problem file `three-cofold-question-cases-time-out-on-windows.md`
  - "[code://packages/agent-cofold/src/capabilities.ts#L81-L96](../../../../packages/agent-cofold/src/capabilities.ts#L81-L96) - `capabilitiesOf`, which builds cofold's shell with `standardCapabilities`"
  - "[code://packages/agent-cofold/src/tools.ts#L56-L69](../../../../packages/agent-cofold/src/tools.ts#L56-L69) - `confirmationOf`, which names the shell language by the platform"
  - "[code://packages/agent-cofold/src/plugin.ts#L73-L78](../../../../packages/agent-cofold/src/plugin.ts#L73-L78) - `optionsOf`, which passes the plugin's values through"
  - npm://@cofold/tools@0.4.2 - `shell({ shell })` and `DEFAULT_SHELL`, which take the program a call runs through
---

## Goal

A cofold case that runs a shell call never times out on a slow PowerShell start on Windows. Four cases timed out on CI that way, the last on #481 on 2026-11-26.

## Reconnaissance

- On Windows, cofold runs each shell call through `powershell.exe -NoProfile -NonInteractive -Command`.
- Each of the four waits that timed out came after the call ran.
- `ToolsConfig.shell` is a boolean, but `@cofold/tools` exports `shell({ shell })`, which takes the program.
- `confirmationOf` names `powershell` on Windows and `bash` elsewhere, whatever program runs the call.
- `optionsOf` passes the plugin's values to `CofoldOptions` with no filter, and the plugin's option schema is open at its root.
- `shellLanguage` in the SDK is `bash` or `powershell`.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A `shell` program on `CofoldOptions`, from code only, for a test | Softov, 2026-11-26, chose "Test shell seam" | 01 |
| The shell language follows the program: `powershell` for powershell and pwsh, `bash` for sh, bash, dash and zsh, none for another | Softov, 2026-11-26, chose "Test shell seam", whose text said the language follows the program | 01 |
| The `env` assignments follow the program too, with `set` for cmd | (defaulted: a command with assignments in another shell's syntax fails) | 01 |
| `optionsOf` drops a `shell` that the plugin's values name | (defaulted: the seam is for code, and a configuration must not reach it) | 01 |
| The cases use `cmd.exe /d /s /c` on Windows and `sh -c` elsewhere | Softov, 2026-11-26, chose "Test shell seam" | 02 |
| Every case that runs a shell call on Windows uses it, not only the four that failed | (defaulted: each of them starts PowerShell the same way) | 02 |
| The case that checks the question's shell language keeps the default shell, and refuses the call so no shell runs | (defaulted: one case still checks the default language on Windows) | 02 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - the-shell-is-chosen-in-code](task-01-the-shell-is-chosen-in-code.md) | todo | - |
| [02 - the-cases-run-a-fast-shell](task-02-the-cases-run-a-fast-shell.md) | todo | 01 |

## Risks and tradeoffs

- No case runs a real PowerShell command on Windows after this.
- A command that differs in cmd, such as `pwd`, needs a command per platform in its case.

## Resume state

- **Done so far:** nothing.
- **Next action:** task 01.
- **Open questions:** none.
- **Watch out for:** `shellLanguage` is absent for cmd, so a case that checks it uses the default shell.

## Final verification checklist

- [ ] The agent-cofold suite passes on Linux.
- [ ] `check-windows` passes.
