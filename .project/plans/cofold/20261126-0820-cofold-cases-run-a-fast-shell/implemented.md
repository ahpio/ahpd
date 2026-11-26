---
title: Cofold cases run their shell calls through a fast shell - implemented
---

## What exists now

- `CofoldOptions.shell` names the program a shell call runs through. The plugin's `optionsOf` drops a `shell` that its values name.
- `shellFamilyOf` in `capabilities.ts` names `powershell`, `bash` or `cmd` by the program's base name, with or without its folder and `.exe`.
- The `env` assignments and the language a question names follow the family. A question about a cmd call names no language.
- `test/support/shell.ts` holds `FAST_SHELL`: `cmd.exe /d /s /c` on Windows and cofold's `sh -c` elsewhere.
- The session helpers of the questions, tools and store files pass it. The one case that checks the language keeps the default shell and refuses its call.

## Verified

- `agent-cofold-shell.test.ts` has 5 cases: families, languages, assignments, a call through a named program, and a dropped plugin value.
- The agent-cofold suite passes on Linux: 20 files, 335 cases.
- `pnpm typecheck`, `pnpm boundary`, `pnpm i18n` and `pnpm sdk-range` pass.

## Departures from the plan

- The `language` argument of `confirmationOf` is required. A default took a passed `undefined` as absent and named bash.
