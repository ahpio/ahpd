---
title: A client reads the list
status: todo
depends: [task-01-the-daemon-keeps-the-list-on-disk.md]
layer: "server"
refs:
  - "[code://packages/server/src/commands/plugin.ts#L86-L100](../../../../packages/server/src/commands/plugin.ts#L86-L100) - `plugin.list`, the action shape this copies"
  - "[code://packages/server/src/pluginschannel.ts#L878-L889](../../../../packages/server/src/pluginschannel.ts#L878-L889) - where the new command joins the others"
  - "[code://packages/server/src/plugins.ts#L137-L138](../../../../packages/server/src/plugins.ts#L137-L138) - `pluginIdOf`, which matches a listed id with an installed plugin"
---

## Objective

`ahpd plugin available`, `GET /plugin/available` and `x-ahpd/plugins/available` answer the listed plugins.
Each entry says whether its id is installed, and at which version.

## Files

- `UPDATE: packages/server/src/commands/plugin.ts:86-100` - the action `plugin.available`.
- `UPDATE: packages/server/src/pluginschannel.ts:878-889` - the command `x-ahpd/plugins/available`.
- `UPDATE: packages/server/test/plugins-channel.test.ts` - the command over a stubbed list.
- `UPDATE: docs/plugins/PLUGINS.md` - the command, its answer and its grant.

## Steps

1. Add `plugin.available` with the CLI pattern `plugin available`, `GET /plugin/available`, `effect: 'read'` and `plugin:list`.
2. Answer `{ marketplaces: [{ url, state: 'on' | 'missing', checkedAt? }], plugins }`; `missing` is no file yet, `[]` is off.
3. Give each entry the list's fields and `versions`, plus `installed` with the installed version, or nothing.
4. Find `installed` by `pluginIdOf` over the configured plugins.
5. When the list marks the installed version `deprecated`, add its message to `installed` and to the row alerts.
6. In the terminal, print one line for each entry: id, newest version, `installed <version>` and description.
7. Add `x-ahpd/plugins/available` with `plugin:list`, which answers the same object.
8. Document the command and its answer in `PLUGINS.md`.

## Validation

- The channel test answers two entries for a stubbed list, with one marked installed.
- `ahpd plugin available` against a written list file prints both lines.
- `pnpm typecheck` passes.

## Resume
