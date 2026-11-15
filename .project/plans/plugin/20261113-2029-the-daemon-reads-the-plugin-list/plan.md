---
title: The daemon reads the plugin list
domain: plugin
status: planned
priority: medium
created: 2026-11-13
revalidated: 2026-11-13
refs:
  - https://github.com/softov/ahpio-site/blob/main/.project/plans/plugins/20261113-2029-ahpio-serves-the-plugin-list/plan.md - the ahpio-site plan that serves the list and its format, built before this one
  - "[code://packages/server/src/update.ts#L22-L23](../../../../packages/server/src/update.ts#L22-L23) - the update check's file and its age, the shape the list's file copies"
  - "[code://packages/server/src/update.ts#L135-L150](../../../../packages/server/src/update.ts#L135-L150) - `refreshUpdate`, one quiet request whose every failure leaves the file as it was"
  - "[code://packages/server/src/commands/run.ts#L2367-L2371](../../../../packages/server/src/commands/run.ts#L2367-L2371) - the background timer that asks again, let go of with `unref`"
  - "[code://packages/server/src/config.ts#L966](../../../../packages/server/src/config.ts#L966) - `updatePath`, where the list's path goes beside it"
  - "[code://packages/server/src/commands/options.ts#L1008-L1013](../../../../packages/server/src/commands/options.ts#L1008-L1013) - `updateCheck`, the setting the two new ones sit beside"
  - "[code://packages/server/src/commands/configure.ts#L339-L367](../../../../packages/server/src/commands/configure.ts#L339-L367) - the questions `ahpd configure` asks"
  - "[code://packages/server/src/commands/plugin.ts#L86-L100](../../../../packages/server/src/commands/plugin.ts#L86-L100) - `plugin.list`, a registry action that the CLI and the HTTP API both serve"
  - "[code://packages/server/src/pluginschannel.ts#L878-L889](../../../../packages/server/src/pluginschannel.ts#L878-L889) - the plugin channel's commands by name"
  - "[code://packages/server/src/install.ts#L264-L292](../../../../packages/server/src/install.ts#L264-L292) - `fittingVersion`, which reads the npm packument today"
  - "[code://packages/server/src/install.ts#L620](../../../../packages/server/src/install.ts#L620) - the install's call to `fittingVersion`"
  - "[code://packages/server/src/install.ts#L865](../../../../packages/server/src/install.ts#L865) - the update's call to `fittingVersion`"
  - "[code://docs/plugins/PLUGINS.md](../../../../docs/plugins/PLUGINS.md) - where the plugin channel's commands are documented"
---

## Goal

The daemon fetches the plugin list from plugins.ahpio.com, keeps it on disk, and serves it to clients.
A client shows each listed plugin, whether it is installed, and its details before an install.
An install of a listed plugin takes the newest version in the list that fits the daemon, and checks it against the list.
The list and its format are the ahpio-site plan [plugins.ahpio.com serves the plugin list](https://github.com/softov/ahpio-site/blob/main/.project/plans/plugins/20261113-2029-ahpio-serves-the-plugin-list/plan.md), which is built first.
The auto-update, the held-back version and the install progress are later plans.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "plugins.json|pluginList" packages/server/src` - nothing; the daemon has no list.
- `rg "fittingVersion\(" packages/server/src` - the install, the update and `selfupdate.ts` call it, each with the npm packument.
- `rg "x-ahpd/plugins/install" docs` - `docs/plugins/PLUGINS.md` and the 0.14 notes.
- `docs/server/REFERENCE.md` - generated from the code, so a new setting and a new action appear there with no edit.

### Runtime path

```
start + every pluginCheckHours -> GET each of pluginMarketplaces (If-None-Match, User-Agent) -> plugin-marketplaces/<hash>.json on disk
client -> x-ahpd/plugins/available -> the marketplaces merged in order, first id wins + installed rows -> entries with marketplace and installed
client -> x-ahpd/plugins/details {id, version?} -> files URLs -> plugin-files/<id>/<version>/ on disk -> readme, changelog, manifest
client -> x-ahpd/plugins/install {name} -> listed? versions from the list : npm packument -> npm install -> integrity or commit check
```

### Gaps

- No setting names a list, and nothing fetches one.
- No command answers a plugin that is not installed.
- `fittingVersion` reads only npm, and an install checks nothing against a list.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The list is on by default; `[]` turns the marketplaces off | Softov, 2026-10-25: "yes" | 01 |
| A daemon reads several marketplaces in order, ours by default; on the same id the first wins, and an entry names its marketplace | Softov, 2026-11-15: "Several, in order" | 01, 02, 03 |
| The setting is `pluginMarketplaces`, as VS Code names `chat.plugins.marketplaces` | Softov, 2026-11-15: "pluginMarketplaces" | 01 |
| A setting holds the URLs, `https://plugins.ahpio.com/v1/plugins.json` by default, and `ahpd configure` asks for it | Softov, 2026-10-25 | 01 |
| The default URL carries the format version, `/v1/plugins.json`, so a later format is served beside it | Softov, 2026-11-14: "/ahpd/plugins/v1.json" | 01 |
| The default URL is `https://plugins.ahpio.com/v1/plugins.json` | Softov, 2026-11-14: "/v1/plugins.json" | 01 |
| The list is at its own host, `plugins.ahpio.com`, which moves by DNS apart from the site | Softov, 2026-11-14: "plugins.ahpio.com" | 01 |
| A listed prerelease is skipped; a prerelease mode for a daemon or a plugin is a later plan | Softov, 2026-11-14: "something we could see to support latter" | 03 |
| A listed version with `deprecated` is never installed or updated to; a plugin row that runs one shows the message | Softov, 2026-11-14: "Keep it, marked" | 02, 03 |
| The list fetch and the auto-update share one period, 12 hours by default | Softov, 2026-10-25 | 01 |
| The period is a setting outside `ahpd configure` | Softov, 2026-10-25: "does not need to be on ahpd configure" | 01 |
| The fetch sends `User-Agent: ahpd/<version>` | Softov, 2026-10-25: "Yes for the User-Agent" | 01 |
| The fetch sends no telemetry | Softov, 2026-10-25: "No telemetry for now" | 01 |
| The list is a registry action and a plugin channel command; each entry says if its id is installed | Softov, 2026-10-25 | 02 |
| A details command answers the README, contracts, links and options schema of one entry | Softov, 2026-10-25 | 04 |
| A client never contacts plugins.ahpio.com or the registry; the daemon fetches and keeps the files | Softov, 2026-10-25 | 04 |
| `fittingVersion` reads a listed plugin's versions from the list, and an unlisted one's from npm | Softov, 2026-11-13 | 03 |
| An install refuses a package whose integrity or commit differs from the list | Softov, 2026-11-13 | 03 |
| The period setting is `pluginCheckHours` | `(defaulted: beside updateCheck, in its style)` | 01 |
| Each list's file is in `plugin-marketplaces/` in the configuration folder, named by a hash of its URL, with its `ETag` | `(defaulted: beside update.json)` | 01 |
| A details file is kept under `plugin-files/<id>/<version>/` and never fetched again | `(defaulted: a version's files never change)` | 04 |
| `x-ahpd/plugins/available` and `details` need `plugin:list` | `(defaulted: the grant that reads the plugin channel)` | 02, 04 |

## Proposed architecture

- **Data flow** - `pluginlist.ts` fetches and reads the list. The action, the channel commands and the install read it from disk, never from the network.
- **Event flow** - The daemon fetches at start when the file is older than the period, then on a timer let go of with `unref`.
- **State flow** - Each file in `plugin-marketplaces/` holds one list, its URL, its `ETag` and `checkedAt`. A fetch that fails leaves it as it was.
- **Layer responsibilities** - `pluginlist.ts`: fetch, read, files · `install.ts`: the listed versions and the check · `commands/plugin.ts`: the action · `pluginschannel.ts`: the commands.
- **Source-of-truth files** - [`code://packages/server/src/pluginlist.ts`](../../../../packages/server/src/pluginlist.ts) once written.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The daemon keeps the list on disk](task-01-the-daemon-keeps-the-list-on-disk.md) | todo | - |
| [02 - A client reads the list](task-02-a-client-reads-the-list.md) | todo | 01 |
| [03 - An install takes a listed version](task-03-an-install-takes-a-listed-version.md) | todo | 01 |
| [04 - A client reads a listed plugin's details](task-04-a-client-reads-a-listed-plugins-details.md) | todo | 02 |

## Risks and tradeoffs

- A list with a wrong `integrity` blocks every install of that version - the install says the list and npm differ, and names both values.
- A proxy that blocks plugins.ahpio.com leaves the daemon with no list - the install by name works, and `available` says why it is empty.
- Files fetched for details fill the disk over time - each file is at most 1 MB, and only the versions a client opened are kept.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-the-daemon-keeps-the-list-on-disk.md](task-01-the-daemon-keeps-the-list-on-disk.md).
- **Open questions:** none.
- **Watch out for:** the tests stub the fetch; no test reaches plugins.ahpio.com.

## Final verification checklist

- [ ] A fresh daemon writes one file in `plugin-marketplaces/`, and a restart within 12 hours does not fetch again.
- [ ] `"pluginMarketplaces": []` fetches nothing, and `available` answers no marketplaces.
- [ ] A second marketplace with an id ours has does not replace ours, and its other plugins appear with their `marketplace`.
- [ ] `ahpd plugin available` prints each listed plugin, with the installed ones marked.
- [ ] An install of `@ahpd/agent-acp` takes its version from the list, and a stubbed list with a wrong `integrity` refuses it.
- [ ] `x-ahpd/plugins/details {id: "agent-acp"}` answers the README of the version that fits the daemon.
- [ ] `pnpm typecheck` and the server tests pass.
