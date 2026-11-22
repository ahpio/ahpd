---
title: A shell asks the person for a password - implemented
date: 2026-11-21
refs:
  - git://ac636ab57
  - "[code://packages/sdk/src/host/shellauth.ts](../../../../packages/sdk/src/host/shellauth.ts)"
  - "[code://packages/sdk/src/host/askpass.ts](../../../../packages/sdk/src/host/askpass.ts)"
---

A command an agent runs - `sudo -A`, `ssh`, `git` - can now ask the person for a password, a passphrase or a yes or no in the window. While the `shellAuthentication` setting is on, the host writes a helper, starts every local agent process and every tool shell with the variables that name it and a token for the chat, and turns a helper's prompt into `chat/inputRequested` with `purpose: shellAuthentication`; `vscode/answerShellAuthentication` sends the answer back down the helper's connection. The answer is in no chat action and no log line, and a person's own terminal and anything running in a machine get no helper.

## What was built

- [`code://packages/sdk/src/host/shellauth.ts`](../../../../packages/sdk/src/host/shellauth.ts) - the owner-only socket (a named pipe on Windows), a token per chat, the prompts in flight, `envFor`, and the cancel rules.
- [`code://packages/sdk/src/host/askpass.ts`](../../../../packages/sdk/src/host/askpass.ts) - the Node helper and the `sh` and `cmd.exe` wrappers that `SUDO_ASKPASS`, `SSH_ASKPASS` and `GIT_ASKPASS` name.
- [`code://packages/sdk/src/host/vscodemethods.ts`](../../../../packages/sdk/src/host/vscodemethods.ts) and [`gate.ts`](../../../../packages/sdk/src/host/gate.ts) - `vscode/answerShellAuthentication` and its `chat:answer` grant; [`vscoderootconfig.ts`](../../../../packages/sdk/src/vscoderootconfig.ts) holds the setting, off by default.
- [`code://packages/sdk/src/host/spawn.ts`](../../../../packages/sdk/src/host/spawn.ts), [`host/shells.ts`](../../../../packages/sdk/src/host/shells.ts) and [`types/agent.ts`](../../../../packages/sdk/src/types/agent.ts) - `Start.env` for a local chat's agent process and the same variables on every tool shell the shell manager opens.
- [`code://packages/agent-claude/src/claude.ts`](../../../../packages/agent-claude/src/claude.ts) and [`session/query.ts`](../../../../packages/agent-claude/src/session/query.ts) - the CLI's own process gets the variables, merged with a pushed token, and a login no longer drops them.
- [`code://packages/agent-acp/src/session/opening.ts`](../../../../packages/agent-acp/src/session/opening.ts) - the preset's environment with the helper's over it on this host, and only the machine's on a machine.
- [`code://packages/agent-pi/src/backend.ts`](../../../../packages/agent-pi/src/backend.ts), [`session.ts`](../../../../packages/agent-pi/src/session.ts) and [`pi.ts`](../../../../packages/agent-pi/src/pi.ts) - pi runs here, so its own shell tool is rebuilt with a spawn hook that merges the variables into every command.
- [`code://packages/agent-cofold/src/capabilities.ts`](../../../../packages/agent-cofold/src/capabilities.ts) and [`turnagent.ts`](../../../../packages/agent-cofold/src/turnagent.ts) - cofold's shell has no environment seam, so every command is prefixed with exported assignments, `sh` syntax on POSIX and PowerShell syntax on Windows.
- [`code://packages/sdk/test/shell-authentication.test.ts`](../../../../packages/sdk/test/shell-authentication.test.ts) and [`shell-authentication-env.test.ts`](../../../../packages/sdk/test/shell-authentication-env.test.ts) - the request and the answer, and which processes get the variables.

## Verified

- `pnpm typecheck` passes.
- `pnpm boundary` passes, with no undeclared dependency in any package.
- No required vitest run happened: the locked command is denied in the session that wrote this. An earlier bare run of `shell-authentication-env.test.ts` passed 5/5, and an accidental start of the full suite was stopped; neither used the lock, and both predate the last edits, so neither is counted. The suites to run are the two files above and the sdk, agent-claude, agent-acp, agent-pi and agent-cofold suites.

## Departures from the plan

- ACP is changed in `session/opening.ts`, where the spawn options are assembled; `connection.ts` already merges the env it is handed.
- pi is changed in `backend.ts`, `session.ts` and `pi.ts`; `agent.ts` declares the agent, while the shell is built in `backend.ts`.
- cofold is changed in `turnagent.ts` and `capabilities.ts`; `agent.ts` is not where a turn's capabilities are built.
- `tools/shell.ts` and `machines/terminals.ts` needed no change: `HeldShellOptions.env` already existed and is applied over the daemon's environment, and the shell manager is the one acquire path.
- `types/agent.ts` gained `Start.env`, which the task did not name; `types/session.ts`'s `env` is the client-facing session environment, not the backend seam.
- `session/query.ts`'s `signedIn` keeps the session's own env under a login, and `claude.ts` merges it with a pushed `ANTHROPIC_API_KEY` instead of letting the token replace it.
- cofold's assignments use `export`, because a bare assignment is not in the command's environment.
- No plan Answer was changed.

## Left for later

- The suites above, and the four test items in the plan's final checklist, stay unchecked until they pass.
- The files tasks 01 and 02 created are untracked, because `git add` is denied in that session, and so they are in neither commit: `packages/sdk/src/host/askpass.ts`, `packages/sdk/src/host/shellauth.ts`, `packages/sdk/test/shell-authentication.test.ts`, `packages/sdk/test/shell-authentication-env.test.ts` and this file. They need staging and an amend.
- No Windows run: the named pipe path and the parent read through the `.cmd` wrapper are untested.
