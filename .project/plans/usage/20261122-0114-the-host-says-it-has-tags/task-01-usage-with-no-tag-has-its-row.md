---
title: Usage with no tag has its row
status: done
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/usage/usage.ts#L492-L505](../../../../packages/sdk/src/usage/usage.ts#L492-L505) - `keysOf` and its comment"
  - "[code://packages/sdk/test/usage-scheme.test.ts#L493-L521](../../../../packages/sdk/test/usage-scheme.test.ts#L493-L521) - the case that sums by tag"
---

## Objective

`usage://groups?by=tag` answers one row for each tag, and one row with no `tag` key for the records that have no tag.

## Files

- `UPDATE: packages/sdk/src/usage/usage.ts:492-505` - `keysOf` returns the other keys alone for a record with no tag; the comment says so.
- `UPDATE: packages/sdk/test/usage-scheme.test.ts:493-521` - the case expects the row with no tag.
- `UPDATE: docs/sdk/USAGE.md:86` - a record with no tag is in a row with no `tag`.
- `UPDATE: .project/specs/usage.md:171-172` - the scenario says the same.

## Steps

1. In `keysOf`, return `[keys]` when `entry.tags` is absent or empty, and one key set per tag otherwise.
2. Say in the comment above `keysOf` that a record with no tag is one set with no `tag`.
3. In the case at `usage-scheme.test.ts:493`, expect a fourth row, `{ keys: {}, names: {}, total: { usd: 8, providerUsd: 8, calls: 1 } }`.
4. Add `by=user,tag` to the case, and expect the record with no tag in a row with `user` and no `tag`.
5. Say in `docs/sdk/USAGE.md:86` and the spec scenario that a record with no tag is in a row with no `tag`.

## Validation

- `packages/sdk/test/usage-scheme.test.ts` passes, with the row with no tag by `tag` and by `user,tag`.
- `node tools/schema.mjs`, then `npx vitest run packages/sdk/test/usage-scheme.test.ts packages/sdk/test/usage-methods.test.ts packages/sdk/test/usage.test.ts` passes.
- `pnpm typecheck` passes.

## Resume

Built on 2026-11-27.
