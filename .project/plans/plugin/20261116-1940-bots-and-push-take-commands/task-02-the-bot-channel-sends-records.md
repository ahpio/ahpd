---
title: The bot channel sends records
status: done
depends: []
layer: "bot"
refs:
  - "[code://packages/bot/src/catalogue.ts](../../../../packages/bot/src/catalogue.ts) - the channel that changes"
  - "[code://packages/bot/src/provider.ts#L550-L580](../../../../packages/bot/src/provider.ts#L550-L580) - the read whose record the channel sends"
  - "[code://packages/bot/src/talks.ts#L53-L61](../../../../packages/bot/src/talks.ts#L53-L61) - `keep`, which makes a reader's `session`"
---

## Objective

`x-ahpd-bots` answers `{ records }`, each `{ id, record }`, and sends `added` and `changed` as `{ id, record }` and `removed` as `{ id }`.
Each record is what a read of `bot://<id>` answers to that reader: the `AGENTS.md` fields, `state` and the reader's own `session`.

## Files

- `UPDATE: packages/bot/src/provider.ts` - move the read's record into the provider's `view(bot)` and `talker(reader)`, and read through them.
- `UPDATE: packages/bot/src/catalogue.ts` - take `BotViews`, keep each bot's talks, send `{ records }` and `{ id, record }`.
- `UPDATE: packages/bot/src/talks.ts` - `all(bot)`, every kept talk of a bot, and an `onKeep` seam.
- `UPDATE: packages/bot/src/names.ts` - `talks(bot)` on the Front rows.
- `UPDATE: packages/bot/src/plugin.ts:552-655` - give the catalogue the views, and tell it when a talk is kept.
- `UPDATE: packages/bot/test/bot-catalogue.test.ts` - the new shape.
- `CREATE: packages/bot/test/bot-catalogue-records.test.ts` - a record per reader, and a kept talk.
- `UPDATE: packages/bot/test/bot-chat.test.ts` - the fake `Talks` gets `all`.

## Steps

1. Write `view` and `talker` on the provider from the read's body, and make the read call them.
2. Make `botCatalogue` take `BotViews` and answer the snapshot as `{ records }` from them.
3. Read each readable bot's talks at each snapshot, and keep them by bot.
4. Send each `added` and `changed` once for each talker with their `session`, and once with none for every other reader.
5. Give each send a `visible` test on the talker, and a copy of the talks, so a replay asks the same test.
6. Keep `removed` as one publish with `{ id }`.
7. Add `talked(slug, talker, session)` to the catalogue, which sends `changed` to that talker's readers who hold the bot.
8. Call `talked` from the `onKeep` seam of the talks in `plugin.ts`.

## Validation

- `bot-catalogue.test.ts`: the snapshot is `{ records }`; a record carries `AGENTS.md` fields and `state`; one reader's `session` is not sent to another; a kept talk sends `changed` to its reader.
- `pnpm --filter @ahpd/bot test` passes.

## Resume

Built on 2026-11-16. A publish per subscriber would miss a client that reconnects with `fromSeq`, so each change is published once for each record and filtered by `visible`. The first build kept the talks in one map that later talks changed, and a replay then asked the wrong test. Each publish now holds a copy.

