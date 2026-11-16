---
title: Bots and push devices take commands - implemented
date: 2026-11-16
refs:
  - git://37affa5dc - the merge of ahpio/ahpd#359
  - "[code://packages/bot/src/commands.ts](../../../../packages/bot/src/commands.ts)"
  - "[code://packages/bot/src/catalogue.ts](../../../../packages/bot/src/catalogue.ts)"
  - "[code://packages/bot/src/agentswatch.ts](../../../../packages/bot/src/agentswatch.ts)"
  - "[code://packages/push/src/channel.ts](../../../../packages/push/src/channel.ts)"
  - "[code://packages/push/src/provider.ts](../../../../packages/push/src/provider.ts)"
  - "[code://packages/sdk/src/resources/resources.ts](../../../../packages/sdk/src/resources/resources.ts)"
---

A client makes, edits and removes a bot with `x-ahpd/bots/put` and `/remove`, and registers and removes a push device with `x-ahpd/push/put` and `/remove`. The bot list is sent as `{ records }`, each record what a read of the bot answers that reader.
An edit a bot makes to its own `AGENTS.md` is sent too. A person changes only their own push devices, and sees them on `x-ahpd-push://`.

## What was built

- [`code://packages/bot/src/commands.ts`](../../../../packages/bot/src/commands.ts) - the two bot commands, over the provider's own write and delete.
- [`code://packages/bot/src/catalogue.ts`](../../../../packages/bot/src/catalogue.ts) - `{ records }`, one send for each talker and one for every other reader, `talked` and `touch`.
- [`code://packages/bot/src/provider.ts`](../../../../packages/bot/src/provider.ts) - `view` and `talker`, which the read and the catalogue share.
- [`code://packages/bot/src/agentswatch.ts`](../../../../packages/bot/src/agentswatch.ts) - one watch per local bot's workspace folder, for `AGENTS.md`.
- [`code://packages/push/src/channel.ts`](../../../../packages/push/src/channel.ts) - the push channel and the two push commands.
- [`code://packages/push/src/provider.ts`](../../../../packages/push/src/provider.ts) - the owner check on a write and a delete.
- [`code://packages/sdk/src/resources/resources.ts`](../../../../packages/sdk/src/resources/resources.ts) - a watch on one file kept on its folder.
- [`code://packages/server/test/records-commands.test.ts`](../../../../packages/server/test/records-commands.test.ts) - the guard over every records channel the daemon serves.

## Verified

- `pnpm typecheck`, `pnpm test:unit` (9126) and `pnpm test:processes` (824) passed locally, one suite at a time, and `pnpm docs:build` passed.
- CI on #359 passed all 16 checks, Windows included, after a test fix for a drive letter in a file URI.
- The guard test, the `AGENTS.md` test and the file watch test each failed with the code they cover taken out.
- The checks by hand are in [bots-and-push-commands-checks.md](../../../pending/bots-and-push-commands-checks.md), not yet run.

## Departures from the plan

- Task 02 sends a change once for each record a reader may be answered, with a `visible` test, not once per subscriber. A client that reconnects with `fromSeq` then gets the same replay.
- Tasks 05 and 06 were added after the build, on Softov's word, for an `AGENTS.md` edit and for a file watch that said `deleted`.

## Left for later

- Removing the resource paths on `bot://` and `push://` - see [deferred.md](deferred.md).
