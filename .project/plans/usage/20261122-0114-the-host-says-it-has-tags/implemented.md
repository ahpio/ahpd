---
title: The host says it has tags - implemented
---

## What exists now

- `keysOf` in `packages/sdk/src/usage/usage.ts` gives a record with no tag one key set with no `tag`. So `usage://groups?by=tag` answers a row with no `tag` for the usage that has none.
- The root `_meta` of the `initialize` answer and of the root state holds `'ahpd.tags': {}`.
- `docs/sdk/USAGE.md` and `.project/specs/usage.md` say both.

## Verified

- `usage-scheme.test.ts` expects the row with no tag by `tag`, and by `user,tag`.
- `plugin-host.test.ts` reads `'ahpd.tags': {}` on the handshake and on the root state.
- The sdk suite passes 5428 cases, and the server suite passes 2008.
- The agent-claude, bot, push, tasks and computer suites pass, since each reads the root `_meta`.
- `pnpm typecheck` passes.

## Departures from the plan

- `rootMeta` in `users-gate-commands.test.ts` leaves out `ahpd.tags`, as it leaves out `ahpd.grants`: every connection is told the same.
