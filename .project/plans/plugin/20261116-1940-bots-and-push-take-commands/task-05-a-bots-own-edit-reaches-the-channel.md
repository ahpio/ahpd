---
title: A bot's own edit reaches the channel
status: done
depends: [task-02-the-bot-channel-sends-records.md]
layer: "bot"
refs:
  - "[code://packages/sdk/src/resources/resources.ts](../../../../packages/sdk/src/resources/resources.ts) - `fileResources().watch`, the watch the plugin uses"
  - "[code://packages/bot/src/catalogue.ts](../../../../packages/bot/src/catalogue.ts) - `touch`, which sends a bot again where it changed"
---

## Objective

An edit a bot makes to its own `AGENTS.md` is sent on `x-ahpd-bots` as `changed`, as an edit through `bot://` is.

## Files

- `CREATE: packages/bot/src/agentswatch.ts` - one watch per local bot's workspace folder, not recursive, for `AGENTS.md`.
- `UPDATE: packages/bot/src/catalogue.ts` - `touch(slug)`, which sends the bot again where its record differs from the one last sent.
- `UPDATE: packages/bot/src/plugin.ts` - open the watches when the store loads and on each make and edit, drop one on a delete, close them all on close.
- `UPDATE: packages/bot/package.json` - declare the closer.
- `CREATE: packages/bot/test/bot-agents-watch.test.ts` - which bots are watched, and when a watch opens and closes.
- `UPDATE: packages/bot/test/bot-catalogue.test.ts` - an edit on disk sent as `changed`, and a save of the bot sent once.
- `UPDATE: docs/plugins/BOTS.md` - the catalogue hears an edit of `AGENTS.md`.

## Steps

1. Write `agentsWatch` over `ResourceStore['watch']`, keyed by slug, with the workspace each watch is on.
2. Watch the workspace folder, not recursively, with `includes: ['AGENTS.md']`.
3. Skip a bot in a machine, and forget a watch whose folder is not there.
4. Keep the last record sent for each bot in the catalogue, and make `touch` send `changed` only where it differs.
5. Wrap the catalogue the provider tells, so each make and edit follows the bot and each delete drops it.

## Validation

- `bot-agents-watch.test.ts` and `bot-catalogue.test.ts` pass.
- With the watch turned off, the catalogue test fails.

## Resume

Built on 2026-11-16. A watch on the file itself was tried first by hand: it said `deleted` for an edit and went silent after a save by rename. Task 06 fixes that in the sdk; this task watches the folder either way, because a bot's folder may not have the file yet.
