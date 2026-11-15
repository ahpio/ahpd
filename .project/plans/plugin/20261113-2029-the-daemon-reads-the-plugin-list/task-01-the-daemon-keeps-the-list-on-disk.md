---
title: The daemon keeps the list on disk
status: todo
depends: []
layer: "server"
refs:
  - "[code://packages/server/src/update.ts#L135-L150](../../../../packages/server/src/update.ts#L135-L150) - `refreshUpdate`, the request and the file this copies"
  - "[code://packages/server/src/commands/run.ts#L2367-L2371](../../../../packages/server/src/commands/run.ts#L2367-L2371) - the timer this copies"
  - "[code://packages/server/src/commands/options.ts#L1008-L1013](../../../../packages/server/src/commands/options.ts#L1008-L1013) - `updateCheck`, the field shape of the new settings"
  - "[code://packages/server/src/commands/configure.ts#L339-L367](../../../../packages/server/src/commands/configure.ts#L339-L367) - `ask`, which the new question uses"
---

## Objective

`pluginMarketplaces` names the marketplace URLs in order, and `pluginCheckHours` the period.
A marketplace is a URL that serves a plugin list in the format of `plugins.ahpio.com/v1/plugins.json`.
The daemon fetches each list when its file is older than the period, and keeps each one in `plugin-marketplaces/`.

## Files

- `CREATE: packages/server/src/pluginlist.ts` - the list's types, `readMarketplaces`, `refreshMarketplace` and `listedVersions`.
- `CREATE: packages/server/test/pluginlist.test.ts` - the fetch, the 304, a failure and a file that does not parse.
- `UPDATE: packages/server/src/config.ts:653` - `pluginMarketplaces` and `pluginCheckHours` in the configuration type.
- `UPDATE: packages/server/src/config.ts:966` - `pluginMarketplacesPath`, the folder `plugin-marketplaces/` beside `update.json`.
- `UPDATE: packages/server/src/commands/options.ts:1008-1013` - the two fields, with their defaults.
- `UPDATE: packages/server/src/commands/run.ts:2367-2371` - the fetch at start and the timer.
- `UPDATE: packages/server/src/commands/configure.ts:339-367` - the question for `pluginMarketplaces`.

## Steps

1. Add `pluginMarketplaces`, an array of URLs, `["https://plugins.ahpio.com/v1/plugins.json"]` by default, where `[]` turns the marketplaces off.
2. Add `pluginCheckHours`, a number, 12 by default, with no question in `ahpd configure`.
3. Write the types of the served file: `version`, `plugins`, each plugin's fields, and each version's fields.
4. Write `refreshMarketplace({ url, version, fetch })`, a GET with `User-Agent: ahpd/<version>` and `If-None-Match` from that list's file.
5. Name each list's file by the first 16 hex digits of its URL's SHA-256, and keep the URL in it.
6. On 200, check `version` is 1 and `plugins` is an array, then write the body, the `ETag` and `checkedAt`.
7. On 304, write only `checkedAt`.
8. Leave the file as it was on any failure, and log one line at debug level.
9. Write `readMarketplaces()`, which answers the lists in `pluginMarketplaces` order, each with its URL, `checkedAt` and plugins, or `missing`.
10. Merge the plugins: on the same id, the first marketplace wins.
11. Give each entry `marketplace`, the URL it came from.
12. In `run.ts`, fetch each list older than the period, then set a timer of the period with `unref`.
13. In `ahpd configure`, ask `Plugin marketplaces` as URLs split by commas, with the current value, where an empty answer turns them off.
14. Remove the file of a list that `pluginMarketplaces` no longer names.

## Validation

- `pnpm --filter @ahpd/server test pluginlist` passes, with cases for 200, 304, 500, a body that is not JSON, and `version: 2`.
- `pnpm typecheck` passes.
- A daemon with an isolated `XDG_CONFIG_HOME` writes one file in `plugin-marketplaces/`.
- A second start within 12 hours makes no request.
- Two stubbed marketplaces with the same id answer the first one's entry, with `marketplace` set to its URL.

## Resume
