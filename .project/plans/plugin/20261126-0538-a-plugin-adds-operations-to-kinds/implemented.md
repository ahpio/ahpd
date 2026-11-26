---
title: A plugin adds operations to kinds it did not register - implemented
date: 2026-11-26
refs:
  - git://ee44b6c81 - main the build started from, with processes
  - "[code://packages/sdk/src/lists/channel.ts](../../../../packages/sdk/src/lists/channel.ts) - where an added operation is listed, offered and run"
---

A plugin adds an operation onto kinds of a list that other plugins registered, or onto the list as a whole, with `registerOperation`.
An operation onto kinds lands under each kind's id, such as `systemd/deploy`, and its `offered` narrows it to some rows.
An operation onto the list is `<plugin>/<id>`, and `ahpd.channels` lists it in the list's `operations`.
The adding plugin's `invoke` runs it, and a long one keeps its processes in the adding plugin.

## What was built

- [`code://packages/sdk/src/types/lists.ts`](../../../../packages/sdk/src/types/lists.ts) - `ListOperation`, its handle and its served form.
- [`code://packages/sdk/src/plugins/validate.ts`](../../../../packages/sdk/src/plugins/validate.ts) - `checkListOperation`.
- [`code://packages/sdk/src/plugins/plugins.ts`](../../../../packages/sdk/src/plugins/plugins.ts) - the registration, and the fold that attaches each added operation and reports a clash.
- [`code://packages/sdk/src/lists/channel.ts`](../../../../packages/sdk/src/lists/channel.ts) - the added operations listed, offered and run.
- [`code://packages/sdk/src/lists/processes.ts`](../../../../packages/sdk/src/lists/processes.ts) - processes kept by a kind or by an adding plugin.
- [`code://packages/sdk/src/host/root.ts`](../../../../packages/sdk/src/host/root.ts) - `operations` on an `ahpd.channels` entry.

## Verified

- `list-added-operations.test.ts` runs 5 cases: the ids and offers, a long deploy and its process, an export, an offer refused, and a clash.
- The sdk suite runs 5410 cases and the server suite 2006, with no failure.
- `pnpm typecheck`, `pnpm build` and `pnpm docs:build` pass.

## Departures from the plan

- A long added operation keeps its processes in the adding plugin, which the plan did not say. Softov chose it on 2026-11-26.
- `PluginChannel` gains `listOperations`, so `ahpd.channels` lists a list's added operations.
- An added operation with processes whose plugin name is a kind of the list is reported, because the two would share a process path.

## Left for later

- Translated words for added operations wait for [a list's operations are translated](../20261126-0538-a-lists-operations-are-translated/plan.md).
