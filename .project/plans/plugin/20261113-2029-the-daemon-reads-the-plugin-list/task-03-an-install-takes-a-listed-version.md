---
title: An install takes a listed version
status: todo
depends: [task-01-the-daemon-keeps-the-list-on-disk.md]
layer: "server"
refs:
  - "[code://packages/server/src/install.ts#L264-L292](../../../../packages/server/src/install.ts#L264-L292) - `fittingVersion`, which gets the list's versions as a second source"
  - "[code://packages/server/src/install.ts#L620](../../../../packages/server/src/install.ts#L620) - the install's call"
  - "[code://packages/server/src/install.ts#L865](../../../../packages/server/src/install.ts#L865) - the update's call"
  - "[code://packages/server/src/selfupdate.ts#L478](../../../../packages/server/src/selfupdate.ts#L478) - the self-update's call, which keeps npm"
---

## Objective

An install or an update of a listed plugin picks its version from the list, with the same rule `fittingVersion` has for npm.
The install then checks the package against the list's `integrity` or `commit`, and removes it when they differ.

## Files

- `UPDATE: packages/server/src/install.ts:264-292` - `fittingVersion` takes the versions from the list when the name is listed.
- `UPDATE: packages/server/src/install.ts:620` - the install of a listed `github:` source pins the commit.
- `UPDATE: packages/server/src/install.ts:721-830` - the check after npm runs.
- `UPDATE: packages/server/test/plugin-install.test.ts` - the listed cases.

## Steps

1. Add `listedVersions(source)` in `pluginlist.ts`, which answers the versions of the first marketplace that has the source, or nothing.
2. In `fittingVersion`, use `listedVersions` when it answers, and the npm packument otherwise, with the same rule.
3. Skip a listed prerelease, as the npm path does, so the list can serve prereleases later.
4. Skip a listed version that has `deprecated`.
5. Keep `selfupdate.ts` on npm, since ahpd itself is not in the list.
6. For a listed `github:` source, install `github:<owner>/<repo>#<commit>` of the chosen version.
7. After npm runs, read the installed package's `integrity` from `node_modules/.package-lock.json` for an npm source.
8. Read the installed commit from the same file's `resolved` for a `github:` source.
9. When the value differs from the list, remove the package and refuse with both values and the list's URL.
10. When no listed version fits the daemon, refuse with the newest version and its `sdk`, as npm does.

## Validation

- An install of a listed name takes the list's version, with no request to the npm packument.
- An install with a stubbed wrong `integrity` refuses, names both values, and leaves no package behind.
- An install of a name the list does not have reads npm, as before.
- `pnpm --filter @ahpd/server test plugin-install` and `pnpm typecheck` pass.

## Resume
