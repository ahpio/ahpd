---
title: The instructions follow the bound tools
status: done
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/tooling.ts#L2946-L2956](../../../../packages/sdk/src/host/tooling.ts#L2946-L2956) - `instructions`, which this task rewrites"
  - "[code://packages/sdk/src/host/tooling.ts#L2844-L2860](../../../../packages/sdk/src/host/tooling.ts#L2844-L2860) - `boundTools`, the list it reads instead"
  - "[code://packages/sdk/src/host/spawn.ts#L1268](../../../../packages/sdk/src/host/spawn.ts#L1268) - the one caller"
---

## Objective

A chat is told the instruction of a host tool only when it is handed that tool.
The filters for both live in one place, so a later gate cannot apply to one and not the other.

## Files

- `UPDATE: packages/sdk/src/host/tooling.ts:383` - `instructions` takes `chatUri` and `provider`, as `boundTools` does.
- `UPDATE: packages/sdk/src/host/tooling.ts:2946-2956` - `instructions` reads the instruction of each tool `boundTools` hands, then the client rules.
- `UPDATE: packages/sdk/src/host/spawn.ts:1268` - the caller passes `chatUri` and `agent.provider`.
- `UPDATE: packages/sdk/test/artifact-gate.test.ts` - a case for a tool with an instruction that a gate withholds.

## Steps

1. Find how `BoundTool` reaches the `HostTool` it came from, and carry its `instruction` if it does not yet.
2. Rewrite `instructions` to map `boundTools(uri, chatUri, provider)` to their instructions, client tools excluded.
3. Keep the order: the tools' instructions in the order offered, then `rulesTold(uri)`.
4. Pass `chatUri` and `agent.provider` from `spawn.ts`.
5. Add a test: an opt-in tool with an instruction, not named, gives no instruction; named, gives one.
6. Add a test: a `topLevelChatOnly` tool with an instruction gives none to a worker chat.

## Validation

- `npx vitest run packages/sdk/test/artifact-gate.test.ts packages/sdk/test/host-tools.test.ts` passes.
- `pnpm typecheck` passes.

## Resume

Done 2026-11-15. `handedTools` in `tooling.ts` is the one list; `offeredTools` and `instructions` both read it. `BoundTool` needed no `instruction`: `handedTools` returns the `HostTool` beside its definition. A bare session now gets no tool instructions, as it gets no tools. The test in `artifact-gate.test.ts` gives an artifact tool an instruction and checks it follows `artifactTools`.
