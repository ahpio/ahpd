---
title: Bots take put and remove commands
status: done
depends: []
layer: "bot"
refs:
  - "[code://packages/bot/src/provider.ts#L598-L741](../../../../packages/bot/src/provider.ts#L598-L741) - the write and delete the commands run"
  - "[code://packages/sdk/src/resources/recordschannel.ts#L441-L494](../../../../packages/sdk/src/resources/recordschannel.ts#L441-L494) - the params and refusals to copy"
---

## Objective

The bot plugin serves `x-ahpd/bots/put` and `x-ahpd/bots/remove`, which run the same write and delete as `resourceWrite` and `resourceDelete` on `bot://<id>`.

## Files

- `CREATE: packages/bot/src/commands.ts` - the two commands over the provider.
- `UPDATE: packages/bot/src/plugin.ts:625-655` - register the provider, then the two commands with `registerMethod`.
- `UPDATE: packages/bot/src/index.ts` - export `botMethods`.
- `UPDATE: packages/bot/package.json` - declare the two commands in `contracts.methods`.
- `UPDATE: packages/bot/test/bot-catalogue.test.ts` - the commands against a host with users, and the catalogue hearing them.

## Steps

1. Write `botMethods(provider)` in `commands.ts`, which answers the two commands by name.
2. Make `put` take `{ id, record, createOnly?, ifMatch? }` and need `bot:put`.
3. Refuse an `id` that is empty or holds `/` or `?`, and a `record` that is not a JSON object, in `recordsMethods` words.
4. Make `put` call the provider's `write` on `bot://<id>` with the record as UTF-8 JSON, the owner, the client and the reader.
5. Make `remove` take `{ id }`, need `bot:delete`, and call the provider's `delete` on `bot://<id>`.
6. Answer `{}` from both, as `recordsMethods` does.
7. Register both in `plugin.ts` after the provider.

## Validation

- `bot-catalogue.test.ts`: a make, a make on a taken id refused `-32010`, an edit with a stale `ifMatch` refused `-32011`, an edit by a person who may not write refused, a remove, a remove of a missing bot.
- `ahpd.methods` lists both commands.
- `pnpm --filter @ahpd/bot test` passes.

## Resume

Built on 2026-11-16. The tests went into `bot-catalogue.test.ts`, which already builds a host with users. A plugin command needs its name in `contracts.methods`.

