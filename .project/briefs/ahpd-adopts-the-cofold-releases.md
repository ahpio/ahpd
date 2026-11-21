---
title: ahpd adopts the cofold releases
created: 2026-11-21
refs:
  - git://fd7084712 - the commit of this repository the facts were checked at (origin/main, 2026-11-21)
  - git://f90a616 - the cofold commit the 2026-11-21 releases were tagged at (release-2026-11-21)
  - "[code://packages/server/src/ask.ts#L1-L131](../../packages/server/src/ask.ts#L1-L131) - the readline questions that `configure` asks, to be moved onto the cofold prompts"
  - "[code://packages/server/src/commands/configure.ts#L253-L590](../../packages/server/src/commands/configure.ts#L253-L590) - `configure()`, about twenty questions in one function"
  - "[code://packages/agent-cofold/src/agent.ts#L168-L193](../../packages/agent-cofold/src/agent.ts#L168-L193) - the permission and effort copies still held by ahpd"
  - "[code://packages/agent-cofold/src/pauses.ts](../../packages/agent-cofold/src/pauses.ts) - the pause workarounds the cofold plan names, now under other names"
  - "[code://packages/agent-acp/src/presets.ts#L214-L216](../../packages/agent-acp/src/presets.ts#L214-L216) - the copapo preset comment about `mcpServers`, which the cofold plan says is stale"
---

# ahpd adopts the cofold releases

The cofold packages released on 2026-11-21 carry work that ahpd can now use.
The terminal package 0.5.0 has prompts, so the questions of `ahpd configure` can use the same select, text and confirm questions as cofold's wizard example.
The other releases carry deletions and fixes that cofold planned for ahpd to make once a release existed.

The goal is to move ahpd onto the new cofold surface without changing what a user sees, except for the prompts themselves.

## What others do

- **cofold's own wizard example.** `examples/commands/wizard` in cofold is a configure flow built on `createPrompts`, with stand-in data. It is the reference for the prompt calls.
- **Not checked:** other projects' configure prompts. This brief does not claim how other tools ask questions.

## What ahpd has today

- `ahpd` pins `@cofold/terminal` at `^0.4.0` in `packages/server/package.json`, and 0.4.0 is installed. 0.5.0 is on npm.
- `packages/server/src/ask.ts` asks questions through `node:readline/promises`. It exports `ask`, `choose`, `confirm`, `answering` and a `Term` with injected streams.
- `ask.ts` refuses to ask without a terminal, and its refusal says so. The `NO_TERMINAL` text is ahpd's own.
- `packages/server/src/commands/configure.ts` calls `ask`, `confirm` and `answering` at about twenty places between lines 281 and 528, and `offerConfigure` and `askToServe` call them too.
- `packages/agent-cofold` imports `EFFORT_LEVELS`, `PERMISSION_MODES`, `PERMISSION_MODE_DESCRIPTIONS` and `effortOf` from `@cofold/agents`, and it still defines `PERMISSION_LABELS` and `PERMISSION_DESCRIPTIONS` locally at `packages/agent-cofold/src/agent.ts` lines 182 to 193.
- `packages/agent-cofold` depends on `@cofold/agents` `^0.4.0` (installed 0.4.0), `@cofold/tools` `^0.4.1` (installed 0.4.1) and `@cofold/store-file` `^0.2.2` (installed 0.2.2).
- The cofold plans that name ahpd work refer to `pauses.ts` functions `owePause`, `payPause`, `rejoin` and `route`. Those names are not in `pauses.ts` today. The file has `createPauses`, so the references are stale and the task must find the current code.
- `packages/agent-acp/src/presets.ts` lines 214 to 216 say copapo over ACP ignores `mcpServers`. The cofold plan on copapo's MCP servers lists that comment as ahpd's work to correct.

## Who writes

- **Worktrees on ahpd.** Ten other worktrees exist under `/github/ahpd.worktrees`. Three of them (`handoff`, `liveness` and `small-fixes`) work on `host/20261121-0554-session-tools-take-model-options`. None of them changes `configure.ts`, `ask.ts`, `packages/agent-cofold` or `packages/agent-acp`, so this change does not collide with them.
- **cofold.** cofold's plans name ahpd as the place where its deferred work goes. cofold does not change ahpd's files.
- **The user.** The user owns the configure flow, and the flow changes only in its prompts in this change.

## The change

- `ahpd` depends on `@cofold/terminal` `^0.5.0`.
- `ask`, `choose` and `confirm` in `ask.ts` keep their signatures and call cofold's `createPrompts` underneath. The `Term` seam keeps its meaning, so a test answers through streams as it does today.
- `configure` keeps the same questions in the same order with the same defaults. Enter keeps the current value, as it does now.
- `agent-cofold` deletes its local copies of the permission labels and descriptions and reads them from `@cofold/agents`.
- Each other cofold item named in the plan is checked against the current code. A reference that no longer matches is recorded as stale, and the task is built or dropped on what the code shows.

## Open points

- The configure redesign (sections, a separate ACP step, a review before apply) is out of this change. It is a separate plan.
- `config add`, `config remove` and the clearer `origins` error are out of this change. They are a separate plan.
- The copapo preset comment may be stale. The plan confirms it against the current copapo before the comment is changed.
