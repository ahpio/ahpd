---
title: The host's instructions read apart from the person's words - implemented
date: 2026-11-15
refs:
  - git://addd41fcc - the merge of #344, the gate this plan builds on
  - "[code://packages/sdk/src/host/tooling.ts](../../../../packages/sdk/src/host/tooling.ts)"
  - "[code://packages/agent-acp/src/session/turn.ts](../../../../packages/agent-acp/src/session/turn.ts)"
  - "[code://packages/agent-claude/src/session/query.ts](../../../../packages/agent-claude/src/session/query.ts)"
---

A chat is told about a host tool only when it is handed that tool. An ACP server gets the host's instructions wrapped as the host's, so a server that joins blocks keeps them apart from the person's words. Claude is told the session's instructions once, and again after a compaction, instead of on every prompt.

## What was built

- [`code://packages/sdk/src/host/tooling.ts`](../../../../packages/sdk/src/host/tooling.ts) - `handedTools`, the one list that `offeredTools` and `instructions` read.
- [`code://packages/sdk/src/host/spawn.ts`](../../../../packages/sdk/src/host/spawn.ts) - the start passes the chat and the provider to `instructions`.
- [`code://packages/agent-acp/src/session/turn.ts`](../../../../packages/agent-acp/src/session/turn.ts) - `wrapped`, used for the session's block and the turn's block.
- [`code://packages/agent-claude/src/session/query.ts`](../../../../packages/agent-claude/src/session/query.ts) - `giveHostInstructions` reads `instructionsGiven`, and `compact_boundary` lowers it.
- [`code://packages/agent-claude/src/session/context.ts`](../../../../packages/agent-claude/src/session/context.ts) - `instructionsGiven`, raised for a resumed session.
- `/github/ahpw` and `/github/ahpc` - the brief `the-client-turns-on-the-artifact-tools.md`, each on its own branch.

## Verified

- `artifact-gate.test.ts`: an artifact tool given an instruction is told only while `artifactTools` is `true`.
- `agent-acp-blocks.test.ts`: both blocks wrapped, and the session's block on the first prompt alone.
- `agent-claude-background-work.test.ts`: the session's instructions on the first prompt, not the second, again after `compact_boundary`, and not for a resumed session.
- `npx vitest run` over `sdk`, `bot` and the four agent packages: 385 files, 6787 tests, all passed. `pnpm typecheck` passed.

## Departures from the plan

- Task 01: `BoundTool` gained no `instruction`. `handedTools` returns the `HostTool` beside its definition instead.
- Task 01: a bare session gets no tool instructions now, as it gets no tools.

## Left for later

- The push of `artifactTools` in ahpw and ahpc, from their briefs.
