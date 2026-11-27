---
title: The handshake says it has tags
status: done
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/handshake.ts#L639](../../../../packages/sdk/src/host/handshake.ts#L639) - `ahpd.channels` in the root `_meta` of the `initialize` answer"
  - "[code://packages/sdk/src/host/root.ts#L923](../../../../packages/sdk/src/host/root.ts#L923) - `ahpd.channels` in the root state's `_meta`"
  - "[code://packages/sdk/test/plugin-host.test.ts#L533-L545](../../../../packages/sdk/test/plugin-host.test.ts#L533-L545) - the case to copy"
---

## Objective

The root `_meta` of the `initialize` answer and of the root state carry `'ahpd.tags': {}`, so a client can tell that the host has tags.

## Files

- `UPDATE: packages/sdk/src/host/handshake.ts:639` - `'ahpd.tags': {}` after `ahpd.channels`, with a comment.
- `UPDATE: packages/sdk/src/host/root.ts:923` - `'ahpd.tags': {}` after `ahpd.channels`.
- `UPDATE: packages/sdk/test/plugin-host.test.ts:533-545` - a case that reads the key on both.
- `UPDATE: docs/sdk/USAGE.md:18-26` - a line that the handshake says the host has tags.
- `UPDATE: .project/specs/usage.md:47-55` - a scenario for the key.

## Steps

1. Add `'ahpd.tags': {}` after `ahpd.channels` in the root `_meta` of `handshake.ts`.
2. Say in the comment that a client offers tags only where this key is, and that the object can grow.
3. Add `'ahpd.tags': {}` after `ahpd.channels` in the root state's `_meta` in `root.ts`.
4. Add a case beside `plugin-host.test.ts:533` that reads `ready._meta['ahpd.tags']` and the root state's, and expects `{}` for both.
5. Under *What a record is* in `docs/sdk/USAGE.md`, say that `initialize` names `_meta['ahpd.tags']` on a host with tags.
6. Add the scenario to `.project/specs/usage.md` under *The tags a record carries*.

## Validation

- The new case in `packages/sdk/test/plugin-host.test.ts` passes.
- `node tools/schema.mjs`, then `npx vitest run packages/sdk/test/plugin-host.test.ts packages/sdk/test/host-handshake.test.ts` passes.
- `pnpm typecheck` passes.

## Resume

Built on 2026-11-27. The case builds a host with no plugin, so it reads the key alone.
