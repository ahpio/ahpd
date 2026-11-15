---
title: A client reads a listed plugin's details
status: todo
depends: [task-02-a-client-reads-the-list.md]
layer: "server"
refs:
  - "[code://packages/server/src/pluginschannel.ts#L878-L889](../../../../packages/server/src/pluginschannel.ts#L878-L889) - where the command joins the others"
  - "[code://packages/server/src/plugins.ts#L393-L438](../../../../packages/server/src/plugins.ts#L393-L438) - `readManifest`, the fields read from an installed `package.json`, which the details read from a listed one"
---

## Objective

`x-ahpd/plugins/details {id, version?}` answers what a details page shows for a listed plugin, before an install.
The daemon fetches each file from the version's `files` once, keeps it on disk, and never sends a client to plugins.ahpio.com.

## Files

- `UPDATE: packages/server/src/pluginlist.ts` - `listedDetails`, the fetch and the files on disk.
- `UPDATE: packages/server/src/pluginschannel.ts:878-889` - the command `x-ahpd/plugins/details`.
- `UPDATE: packages/server/src/config.ts:966` - `pluginFilesPath`, beside `pluginListPath`.
- `UPDATE: packages/server/test/pluginlist.test.ts` - the details over stubbed files.
- `UPDATE: docs/plugins/PLUGINS.md` - the command and its answer.

## Steps

1. Pick the version: the one named, or the newest listed version that fits the daemon.
2. Fetch `manifest`, `readme`, `changelog` and `license` from `files`, each when the version has it.
3. Keep each file at `plugin-files/<id>/<version>/<name>`, and read it from there the next time.
4. Refuse a file larger than 1 MB, and a URL that is not `https:`.
5. Answer `id`, `version`, `versions`, `readme`, `changelog`, `license`, and from the manifest `contracts`, `links`, `optionsSchema`, `homepage`, `bugs` and `repository`.
6. Answer each icon of `files.icons` as a `data:` URI, with the icon rules of an installed plugin.
7. Answer the parts it could fetch, with one `problem` for each part it could not.
8. Add `x-ahpd/plugins/details` with `plugin:list`, and document it in `PLUGINS.md`.

## Validation

- The test answers the README and the contracts of a stubbed version, and a second call makes no request.
- A version with no `changelog` answers no `changelog` and no problem.
- `pnpm typecheck` and the server tests pass.

## Resume
