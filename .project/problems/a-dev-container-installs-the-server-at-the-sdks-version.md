---
title: A dev container installs the server at the sdk's version
status: open
date: 2026-11-16
severity: minor
blocks: []
refs:
  - "[code://packages/computer/src/plugin.ts#L2428-L2429](../../packages/computer/src/plugin.ts#L2428-L2429) - the dev container pins the server it installs to `host.version`"
  - "[code://packages/server/src/plugins.ts#L1557](../../packages/server/src/plugins.ts#L1557) - a plugin's `context.version`, which the loader fills with the sdk's version"
  - "[code://packages/server/src/plugins.ts#L1952](../../packages/server/src/plugins.ts#L1952) - `pluginSet` takes `options.version`, or `sdkVersion()`"
  - "[code://packages/sdk/src/types/plugin.ts#L735-L736](../../packages/sdk/src/types/plugin.ts#L735-L736) - `PluginContext.version`, documented as the version of `@ahpd/sdk` in use"
  - git://2cf789740 - main when the problem was read
---

## Symptom

Found on 2026-11-16, in the build of plugin/20261116-1816.
The computer plugin installs `@ahpd/server@<version>` in a dev container, and takes `<version>` from `host.version`.
`PluginContext.version` is the version of `@ahpd/sdk` in use, not the server's.
`computer-devcontainer.test.ts`: `installs the server in a container at the daemon's version` passes the version it expects through the loader's `version` option.

## Cause

Every release so far gives the sdk and the server one version, so the two values are equal.
Plan plugin/20261116-1816 makes the sdk the gate for plugins, so the two can differ in a later release.

## Impact

None while the versions are equal.
A release whose sdk keeps an older version would install that older server in each dev container.

## Workaround

None needed while the versions are equal.

## Fix

Candidate fixes, none chosen yet:

- Give a plugin's context the daemon's version beside the sdk's, under two names.
- Pin the server in a dev container to the ahpd part of `versions.json`, as a box is.
