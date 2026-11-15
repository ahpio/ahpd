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

`pluginList` names the list URL, and `pluginCheckHours` the period.
The daemon fetches the list at start when its file is older than the period, then once each period, and keeps it in `plugin-list.json`.

## Files

- `CREATE: packages/server/src/pluginlist.ts` - the list's types, `readPluginList`, `refreshPluginList` and `listedVersions`.
- `CREATE: packages/server/test/pluginlist.test.ts` - the fetch, the 304, a failure and a file that does not parse.
- `UPDATE: packages/server/src/config.ts:653` - `pluginList` and `pluginCheckHours` in the configuration type.
- `UPDATE: packages/server/src/config.ts:966` - `pluginListPath`, beside `updatePath`.
- `UPDATE: packages/server/src/commands/options.ts:1008-1013` - the two fields, with their defaults.
- `UPDATE: packages/server/src/commands/run.ts:2367-2371` - the fetch at start and the timer.
- `UPDATE: packages/server/src/commands/configure.ts:339-367` - the question for `pluginList`.

## Steps

1. Add `pluginList`, a string, `https://plugins.ahpio.com/v1/plugins.json` by default, where an empty string turns the list off.
2. Add `pluginCheckHours`, a number, 12 by default, with no question in `ahpd configure`.
3. Write the types of the served file: `version`, `plugins`, each plugin's fields, and each version's fields.
4. Write `refreshPluginList({ url, version, fetch })`, a GET with `User-Agent: ahpd/<version>` and `If-None-Match` from the file.
5. On 200, check `version` is 1 and `plugins` is an array, then write the body, the `ETag` and `checkedAt`.
6. On 304, write only `checkedAt`.
7. Leave the file as it was on any failure, and log one line at debug level.
8. Write `readPluginList()`, which answers the list and `checkedAt`, or nothing for a missing or broken file.
9. In `run.ts`, fetch when the file is older than the period, then set a timer of the period with `unref`.
10. In `ahpd configure`, ask `Plugin list` with the current value, where an empty answer turns it off.

## Validation

- `pnpm --filter @ahpd/server test pluginlist` passes, with cases for 200, 304, 500, a body that is not JSON, and `version: 2`.
- `pnpm typecheck` passes.
- A daemon started with an isolated `XDG_CONFIG_HOME` writes `plugin-list.json`; a second start within 12 hours makes no request.

## Resume
