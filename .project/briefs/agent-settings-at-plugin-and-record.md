---
title: Agent settings at the plugin and the record
created: 2026-11-05
refs:
  - git://05671213e - the commit of ahpd the facts were checked at, on 2026-11-19
  - git://8ba783e1c - the last commit that holds the table of 2026-11-05, by setting and level
  - "[code://packages/agent-acp/package.json](../../packages/agent-acp/package.json) - the acp plugin's options"
  - "[code://packages/agent-acp/src/plugin.ts#L96-L198](../../packages/agent-acp/src/plugin.ts#L96-L198) - `RECORD_FIELDS`, the acp record's fields in their order"
  - "[code://packages/agent-claude/package.json](../../packages/agent-claude/package.json) - the claude plugin's options"
  - "[code://packages/agent-claude/src/options.ts#L492-L563](../../packages/agent-claude/src/options.ts#L492-L563) - `DECLARED` and `OF_A_VARIANT`, the claude record's fields in their order"
  - "[code://packages/agent-claude/src/plugin.ts#L66-L87](../../packages/agent-claude/src/plugin.ts#L66-L87) - claude's `paths`, which falls back to the host's"
  - "[code://packages/agent-claude/src/plugin.ts#L147](../../packages/agent-claude/src/plugin.ts#L147) - a claude session starts on the record's top-level `model`"
  - "[code://packages/agent-claude/src/claude.ts#L117-L127](../../packages/agent-claude/src/claude.ts#L117-L127) - `computerConfigDir`, a plugin option today"
  - "[code://packages/agent-cofold/package.json](../../packages/agent-cofold/package.json) - the cofold plugin's options"
  - "[code://packages/agent-cofold/src/plugin.ts#L89](../../packages/agent-cofold/src/plugin.ts#L89) - `NOT_A_RECORD`: a cofold record takes every option but these, in the options' order"
  - "[code://packages/agent-pi/package.json](../../packages/agent-pi/package.json) - the pi plugin's options"
  - "[code://packages/agent-pi/src/plugin.ts#L84](../../packages/agent-pi/src/plugin.ts#L84) - `NOT_A_RECORD`: a pi record takes every option but these, in the options' order"
---

# Agent settings at the plugin and the record

Softov wants the four agent plugins' settings refined, at the plugin and at the record. Each form lists its fields in one order of purpose, so a person reads them in the order Softov set. Fields added later went between fields of another purpose. Some settings move between the plugin and the record, and some leave.

## What others do

- VS Code draws a settings page in the order its contributions declare, grouped by their `order` and their title.
- ahpw draws a form in the schema's own order. See `src/resources/agents/form.ts` `engineSchema` in ahpw, and its test of the drawn order.

## What ahpd has today

The fields at `05671213e`, in the order each form draws them.

| Form | Fields |
| --- | --- |
| acp plugin | `hostTools`, `toolsChanged` |
| acp record | `base`, `command`, `install`, `page`, `args`, `env`, `cwd`, `authenticate`, `hostTools`, `honoursTrust`, `toolsChanged`, `cutTurns`, `stderrTail`, `modes`, `unreportedClientCalls`, `findFreshMs`, `listingIdleMs`, `sessionListMaxPages`, `exitGraceMs`, `stderrBytes`, `killGraceMs`, `closeGraceMs`, `machine` |
| claude plugin | `paths`, `computerExecutable`, `computerCli`, `computerCliFallback`, `computerConfigDir`, `handshakeTimeoutMs`, `hostTools` |
| claude record | `sandbox`, `thinking`, `hostTasks`, `hostTools`, `enableTasks`, `cliStart`, `stopEnds`, `dontAsk`, `portFailures`, `subagentsFrom`, `taskOutputFirstWaitMs`, `taskOutputLongestWaitMs`, `taskOutputQuietReads`, `subagentTitleMax`, `subagentStartTimeoutMs`, `maxShellInitScript`, `maxTerminalOutputBytes`, `keepFramed`, `watchWaitMs`, `fileMostBytes`, `ruleDepth`, `ruleMost`, `outputStyle`, `env`, `logins`, `extraArgs`, `models`, `modelSources`, `keepCliModels` |
| cofold plugin | `model`, `baseUrl`, `models`, `instructions`, `computerConfigDir`, `store`, `memory`, `tools`, `strictTools`, `apiKey`, `resource`, `autoCompactTokens`, `autoCompactAt`, `catalogueTimeoutMs`, `hostTools` |
| cofold record | the plugin's, without `model` and `strictTools` |
| pi plugin | `model`, `baseUrl`, `apiKey`, `projectTrust`, `sessionDir`, `hostTools` |
| pi record | the plugin's, without `model`, then `env` |

- The tuning fields of acp, `cutTurns` to `closeGraceMs`, came with the VS Code parity audit. They went between `toolsChanged` and `machine`.
- The claude tuning fields, `cliStart` to `ruleMost`, went between `enableTasks` and `outputStyle`.
- Only claude has `paths`. pi takes the host's paths, and acp and cofold read none.
- A claude session starts on the record's `model`, but the claude plugin has no default `model`. cofold and pi have one.
- Claude's `computerConfigDir` is a plugin option only. cofold has it at both levels, on a host record only.
- cofold's `memory` says "For tests", and both cofold forms show it.

## Who writes

No open PR and no remote branch touches the four `packages/agent-*` packages. ahpw draws what the host sends, so the change needs no ahpw work.

## The change

- Every form of the four plugins lists its fields by purpose, in this order of groups:
  1. Model: `model`, `models`, `modelSources`, `keepCliModels`, `baseUrl`, `apiKey`, `resource`.
  2. Prompt: `instructions`, `outputStyle`, `thinking`, `autoCompactTokens`, `autoCompactAt`.
  3. Tools: `hostTools`, `toolsChanged`, `hostTasks`, `enableTasks`, `tools`, `strictTools`.
  4. Run: `base`, `command`, `args`, `install`, `page`, `env`, `cwd`, `authenticate`, `logins`, `extraArgs`, `sandbox`.
  5. Folders and trust: `honoursTrust`, `projectTrust`, `sessionDir`, `store`.
  6. Machines: `machine`, `computerExecutable`, `computerCli`, `computerCliFallback`, `computerConfigDir`.
  7. Tuning: the timeouts, the limits and the VS Code parity switches, and `memory` last.
- The tuning fields of acp and claude stay on the record, in the Tuning group.
- cofold's `memory` is a plugin option only.
- The claude plugin has no `paths`. Claude takes the host's paths, as pi does. A config that sets it gets a warning at load, and the value is ignored.
- The claude plugin has a default `model` for a record that names none, as cofold and pi have.
- A claude record may set `computerConfigDir`, on a host record only, as cofold's may.

| Form | Fields, after the change |
| --- | --- |
| acp plugin | `hostTools`, `toolsChanged` |
| acp record | `hostTools`, `toolsChanged`, `base`, `command`, `args`, `install`, `page`, `env`, `cwd`, `authenticate`, `honoursTrust`, `machine`, `cutTurns`, `stderrTail`, `modes`, `unreportedClientCalls`, `findFreshMs`, `listingIdleMs`, `sessionListMaxPages`, `exitGraceMs`, `stderrBytes`, `killGraceMs`, `closeGraceMs` |
| claude plugin | `model`, `hostTools`, `computerExecutable`, `computerCli`, `computerCliFallback`, `computerConfigDir`, `handshakeTimeoutMs` |
| claude record | `models`, `modelSources`, `keepCliModels`, `outputStyle`, `thinking`, `hostTools`, `hostTasks`, `enableTasks`, `env`, `logins`, `extraArgs`, `sandbox`, `computerConfigDir`, `cliStart`, `stopEnds`, `dontAsk`, `portFailures`, `subagentsFrom`, `taskOutputFirstWaitMs`, `taskOutputLongestWaitMs`, `taskOutputQuietReads`, `subagentTitleMax`, `subagentStartTimeoutMs`, `maxShellInitScript`, `maxTerminalOutputBytes`, `keepFramed`, `watchWaitMs`, `fileMostBytes`, `ruleDepth`, `ruleMost` |
| cofold plugin | `model`, `baseUrl`, `apiKey`, `resource`, `models`, `instructions`, `autoCompactTokens`, `autoCompactAt`, `hostTools`, `tools`, `strictTools`, `store`, `computerConfigDir`, `catalogueTimeoutMs`, `memory` |
| cofold record | `baseUrl`, `apiKey`, `resource`, `models`, `instructions`, `autoCompactTokens`, `autoCompactAt`, `hostTools`, `tools`, `store`, `computerConfigDir` |
| pi plugin | `model`, `baseUrl`, `apiKey`, `hostTools`, `projectTrust`, `sessionDir` |
| pi record | `baseUrl`, `apiKey`, `hostTools`, `env`, `projectTrust`, `sessionDir` |

## Answers

Softov chose each of these on 2026-11-19:

- The same groups in the order of *The change*, for the four plugins, at both levels: "Same groups, this order (Recommended)".
- The tuning fields stay on the record, last: "Keep on the agent, last".
- cofold's `memory` is a plugin option only, last: "Keep, plugin only, last (Recommended)".
- Claude's `paths` leaves, and Claude takes the host's: "Remove, use the host's (Recommended)".
- The claude plugin gets a default `model`: "Add a default model (Recommended)".
- Claude's `computerConfigDir` is at both levels, on a host record only: "Plugin, computerConfigDir both (Recommended)".
