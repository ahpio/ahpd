---
title: Plugins follow the release line
created: 2026-11-16
refs:
  - git://0b1e81dbd - the commit of ahpd the facts were checked at
  - "[code://packages/server/src/install.ts#L267-L282](../../packages/server/src/install.ts#L267-L282) - `fittingVersion`, which leaves out every prerelease and every version newer than `latest`"
  - "[code://packages/server/src/pluginlist.ts#L496-L503](../../packages/server/src/pluginlist.ts#L496-L503) - `fittingListed`, the same choice for a plugin from a list, which leaves out every prerelease"
  - "[code://packages/server/src/compat.ts#L64-L78](../../packages/server/src/compat.ts#L64-L78) - `newestFitting`, the newest offered version whose range admits the daemon"
  - "[code://packages/server/src/install.ts#L902](../../packages/server/src/install.ts#L902) - `updatePlugins`, which `plugin update`, `ahpd update` and the container entrypoint run"
  - "[code://packages/agent-acp/package.json](../../packages/agent-acp/package.json) - a backend's `@ahpd/sdk` peer range, `>=0.14 <1` on main"
  - "[code://.github/workflows/release.yml#L137-L153](../../.github/workflows/release.yml#L137-L153) - the release's check of the ranges in each tarball"
  - git://03510a324 - the change that removed `callTimes`, `withCallTimes` and `startOf` from the sdk
  - npm://semver@7.8.6 - its README, *Prerelease Tags*: a prerelease satisfies a range only through a comparator of the same `[major, minor, patch]` with a prerelease tag
  - npm://@babel/plugin-transform-runtime@7 - a plugin that peers on `@babel/core ^7.0.0-0`, so the 7 prereleases are admitted
---

# Plugins follow the release line

Softov wants an upgrade to keep every agent working, also an upgrade to a release candidate.
On 2026-11-16, an upgrade from 0.14.0 to `0.15.0-rc.3` left no backend loaded.
He chose two changes that day:

- A daemon on a prerelease takes the plugins of its own prerelease line.
- Each release sets the first-party plugins' range to its own minor.

## What was found

The check ran on 2026-11-16, with the packages on npm, in a folder apart from Softov's daemons:

- sdk 0.15 removed `callTimes`, `withCallTimes` and `startOf` in `03510a324`.
- agent-acp, agent-claude, agent-cofold and agent-pi 0.14.0 import them, and declare `@ahpd/sdk >=0.10 <1`.
- The other nine packages at 0.14.0 import nothing that sdk 0.15 lacks.
- After `npm i -g @ahpd/server@0.15.0-rc.3`, the 0.14.0 backends still load, because the config folder keeps sdk 0.14.0.
- The next `ahpd plugin install` pins the folder's sdk to the daemon's version. From the next restart, no backend imports, and the daemon serves no session.
- `ahpd plugin update all` on that daemon answers "Nothing to update".
- At a stable release the same update finds the new backends, since they are not prereleases.

## What others do

- **npm's `semver`** (README, *Prerelease Tags*, semver 7.8.6): a prerelease satisfies a range only through a comparator of its own `[major, minor, patch]` with a prerelease tag. A prerelease belongs to its own line.
- **Babel**: a plugin peers on `@babel/core ^7.0.0-0`. The `-0` lets the prereleases of 7 satisfy it, and the range ends at the next major. Babel's API breaks only at a major, so one range per major is safe there.
- ahpd's sdk is at 0, where a minor can remove an export, so one range per minor is the same rule at ahpd's version.

## What ahpd has today

- `fittingVersion` leaves out every prerelease, and every version newer than npm's `latest` ([`code://packages/server/src/install.ts`](../../packages/server/src/install.ts#L267-L282)).
- `fittingListed` leaves out every prerelease of a plugin from a list ([`code://packages/server/src/pluginlist.ts`](../../packages/server/src/pluginlist.ts#L496-L503)).
- `newestFitting` takes the newest offered version whose range admits the daemon ([`code://packages/server/src/compat.ts`](../../packages/server/src/compat.ts#L64-L78)).
- `ahpd update` moves the plugins with the code of the daemon that runs before the update. A 0.14.0 daemon does not have this change.
- Each backend on main declares `@ahpd/sdk >=0.14 <1` ([`code://packages/agent-acp/package.json`](../../packages/agent-acp/package.json)).
- A release bump sets the 13 versions by hand, as in #320. No script sets the peer ranges.
- The release checks that no tarball holds `workspace:` ([`code://.github/workflows/release.yml`](../../.github/workflows/release.yml#L137-L153)). It does not check the `@ahpd/sdk` peer range.

## Who writes

Checked on 2026-11-16:

- No branch of `origin` other than `main` changes `install.ts`, `pluginlist.ts`, `selfupdate.ts` or `release.yml`.
- No pull request is open on `ahpio/ahpd`.

## The change

- A daemon on a prerelease also takes the prereleases of its own `[major, minor, patch]` line, when it picks a plugin's version.
  - It takes none newer than itself.
  - A daemon on a stable version takes no prerelease, as today.
- `fittingVersion` and `fittingListed` take the same rule, so npm and a list agree.
- `ahpd update` to a release candidate runs the old daemon's code, so the release notes tell a tester to run `ahpd plugin update all` after it.
- Each release sets every first-party plugin's `@ahpd/sdk` peer range to its own minor, such as `>=0.15.0-0 <0.16.0-0`.
  - The `-0` admits the minor's prereleases, as Babel's range does.
- The release refuses a tarball whose `@ahpd/sdk` range does not admit the version being released.
- A plugin from an older minor is then refused by its range, and `plugin update` moves it, in place of an import that fails.
- The 0.15 release notes say both, under *Upgrading*.
