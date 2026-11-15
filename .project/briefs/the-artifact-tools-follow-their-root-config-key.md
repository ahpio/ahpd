---
title: The artifact tools follow their root config key
created: 2026-11-15
refs:
  - git://0d84c2e27 - the commit of this repository the facts were checked at
  - git://1564f100807a - VS Code main, the reference checked, in /github/externals/vscode
  - https://github.com/ahpio/ahpd/pull/344 - Maks's pull request, which gates the set on `artifactTools` alone
  - file:///home/softov/projects/ahp-analis/ahpd-config-defaults-report.md - the root config defaults report, whose `artifactTools` row this brief corrects
  - "[code://packages/sdk/src/vscoderootconfig.ts#L223-L234](../../packages/sdk/src/vscoderootconfig.ts#L223-L234) - `artifactTools`, declared with default `false`, read by nothing"
  - "[code://packages/sdk/src/tools/index.ts#L32-L35](../../packages/sdk/src/tools/index.ts#L32-L35) - `hostTools()` spreads `artifactTools()` with no check"
  - "[code://packages/sdk/src/tools/artifacts.ts#L177-L200](../../packages/sdk/src/tools/artifacts.ts#L177-L200) - `ARTIFACT_TOOLS_INSTRUCTION`, and the add tool's description that says the same"
  - "[code://packages/sdk/src/host/tooling.ts#L531-L535](../../packages/sdk/src/host/tooling.ts#L531-L535) - `shellToolsFor`, the switch the terminal tool reads from root config"
  - "[code://packages/sdk/src/host/tooling.ts#L551-L558](../../packages/sdk/src/host/tooling.ts#L551-L558) - `contributingTo`, the tools a session is offered"
  - "[code://packages/sdk/src/host/tooling.ts#L2941-L2951](../../packages/sdk/src/host/tooling.ts#L2941-L2951) - `instructions`, what a chat is told, filtered apart from `contributingTo`"
  - "[code://packages/agent-acp/src/session/turn.ts#L320-L327](../../packages/agent-acp/src/session/turn.ts#L320-L327) - the session's instructions as their own text block, ahead of the first prompt"
  - "[code://packages/agent-claude/src/session/query.ts#L190-L202](../../packages/agent-claude/src/session/query.ts#L190-L202) - the session's instructions given on every prompt"
  - https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/node/shared/artifactServerTools.ts#L74 - the add tool's description, which carries the wording
  - https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/node/shared/artifactServerTools.ts#L146-L151 - `isEnabled` and `isEnabledForSession` on the artifact tool group
  - https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/node/agentService.ts#L2656-L2658 - `_isArtifactToolsEnabled`, root config `artifactTools === true`
  - https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/node/chatContributions/artifactTools/artifactToolsContribution.ts#L30-L43 - the first-turn instruction, gated on `artifactTools` and `artifactIntegrations`, once per chat
  - https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/common/artifactToolsConfiguration.ts#L13-L31 - the window settings: `chat.artifactTools.enabled` default `true`, `chat.artifactIntegrations.enabled` default `false`
---

# The artifact tools follow their root config key

Softov wants the root config key `artifactTools` to switch the artifact tools and their instruction, as it does in VS Code's host. Today ahpd offers the three tools and tells every chat about them, whatever the key holds. Softov's own `root-config.json` holds `"artifactTools": false`, and Softov's Claude sessions still get the instruction on every prompt. Maks found the same thing from a Telegram client on ACP, where the instruction reads as part of the person's first message, and opened #344.

## What others do

VS Code's host at `1564f100807a`:

| What | How |
|---|---|
| The tools | The artifact tool group has `isEnabled` and `isEnabledForSession`, both `artifactTools === true` in root config. Off, no session is offered them. |
| The wording | The "Record ... so they are surfaced next to the chat input" text is the add tool's `description`. It is not a turn instruction. |
| The turn instruction | `ArtifactToolsContribution` adds one instruction, the list of artifact kinds the integrations support. It needs both `artifactTools` and `artifactIntegrations`, and it is said on the first turn of a chat only. |
| Host defaults | `artifactTools` `false`, `artifactIntegrations` `false`, in `platformRootSchema`. |
| Window defaults | `chat.artifactTools.enabled` `true` (experiment `auto`), `chat.artifactIntegrations.enabled` `false`. A VS Code window pushes these at connect, so a VS Code user has the tools and no turn instruction. |
| Delivery | Host instructions go to a provider as `hostInstructions`, "without persisting as user content". The Claude and Copilot agents give them through the `UserPromptSubmit` hook's `additionalContext`. |

VS Code has no ACP backend, so it has no answer for how an ACP server is told.

## What ahpd has today

- `vscoderootconfig.ts` declares `artifactTools`, default `false`. No code reads it. `artifactIntegrations` is not declared.
- `hostTools()` always includes `artifactTools()`, and the three tools have no `optIn` and no `isEnabledForSession`.
- `contributingTo` offers them to every session. `instructions` tells every chat `ARTIFACT_TOOLS_INSTRUCTION`.
- `ARTIFACT_TOOLS_INSTRUCTION` says almost what the add tool's description says. Its comment says the reference adds it to the first turn; at `1564f100807a` the reference adds only the integrations list.
- `contributingTo` and `instructions` filter apart. `contributingTo` also reads `sessionToolsFor` and `shellToolsFor`; `instructions` reads only `optIn` and `isEnabledForSession`. A gate in one and not the other tells the model about a tool it does not have.
- `shellToolsFor` reads `enableCustomTerminalTool` from root config, live. That is the shape a root config switch has here.
- `agent-acp` sends the session's instructions as their own text block, before the first prompt's text. The ACP server decides how blocks reach the model. opencode joins them with no separator, so the model reads `...an artifact to register.hello`.
- `agent-claude` gives the session's instructions in `additionalContext` on every prompt, not once per chat.
- The `artifactTools` row of the defaults report says "ahpd has no artifact tools". In fact ahpd has the tools, always on.

## Who writes

- #344 (`34x:fix/no-tools-instructions`, 2 commits on `7bc308a23`) changes `tooling.ts`, `tools/artifacts.ts` and five test files. It gates the tools and the instruction on `artifactTools` alone, default off. It keeps `ARTIFACT_TOOLS_INSTRUCTION` as a turn instruction. The change here either builds on it or replaces it.
- `maycxc/host/124-an-agents-shell-is-a-terminal-the-person-sees` changes `tooling.ts`, `tools/index.ts` and `vscoderootconfig.ts`. The other `maycxc` branches that change `tooling.ts` are from 2026-11-01. A gate next to `shellToolsFor` merges with each of them.
- No `origin` branch has unmerged changes to these files.

## The change

- The artifact tools are offered only when root config `artifactTools` is `true`, read live, as `shellToolsFor` reads its key.
- The gate applies to the tools and to anything said about them, from one place, so the two cannot disagree.
- The "Record notable artifacts" turn instruction goes, since the add tool's description already carries it, as in VS Code.
- `artifactIntegrations` is declared from `platformRootSchema`, default `false`.
- The defaults report's `artifactTools` row is corrected.

## Open points

- The default with no client push. VS Code's host default is off and its window default is on. Neither ahpc nor ahpw pushes it, so a default of off removes the tools for every ahpc and ahpw user, Softov included.
- Keep or drop `ARTIFACT_TOOLS_INSTRUCTION`. Dropping it follows VS Code. A model that defers tool descriptions may then call the add tool less often.
- #344: merge it and build on it, or ask Maks to change it to this shape.
- How `agent-acp` marks instructions so an ACP server that joins blocks still keeps them apart from the person's text. A separator or a wrapper tag are two ways. No reference covers it.
- Whether `agent-claude` gives the session's instructions once per chat, as VS Code's contribution does, or on every prompt as now. This touches every instruction, not only this one.
- Whether `instructions` should derive from `contributingTo`, as #344's body proposes, so no later gate drifts.
