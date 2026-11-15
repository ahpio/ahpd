---
title: An ACP prompt wraps the host's instructions
status: todo
depends: []
layer: "agent-acp"
refs:
  - "[code://packages/agent-acp/src/session/turn.ts#L295-L327](../../../../packages/agent-acp/src/session/turn.ts#L295-L327) - `blocksFor`, which makes the two instruction blocks"
  - "[code://packages/agent-acp/test/agent-acp-blocks.test.ts#L320-L334](../../../../packages/agent-acp/test/agent-acp-blocks.test.ts#L320-L334) - the case that reads the blocks a prompt sends"
---

## Objective

Each instruction block an ACP prompt sends is wrapped in `<host_instructions>` and ends with a blank line.
A server that joins the blocks still gives the model a clear break before the person's words.

## Files

- `UPDATE: packages/agent-acp/src/session/turn.ts:295-327` - one helper wraps a list of instructions; both blocks use it.
- `UPDATE: packages/agent-acp/test/agent-acp-blocks.test.ts:320-334` - the expected text carries the tag.

## Steps

1. Add `wrapped(said: string[]): string` in `turn.ts`, returning `<host_instructions>\n` + the joined text + `\n</host_instructions>\n\n`.
2. Use it for the session's block and for the turn's block in `blocksFor`.
3. Say in the comment on `blocksFor` why the tag is there: a server may join text blocks with no break.
4. Update the expected `blocks=` line in the test.
5. Add a case for the session's block, sent on the first prompt only.

## Validation

- `npx vitest run packages/agent-acp/test/agent-acp-blocks.test.ts` passes.
- `pnpm typecheck` passes.

## Resume

