---
title: A list has instances - implemented
date: 2026-11-26
refs:
  - "[code://packages/sdk/src/lists/channel.ts](../../../../packages/sdk/src/lists/channel.ts) - the row keys, the owner rule, and an instance that comes or goes"
---

A list with `instances: true` holds rows from several sources of one kind, such as one Desk connector each.
A kind adds and removes an instance while the host runs, and a row is `<name>://<instance>/<id>`.
A reader sees the rows of the instances whose owner lets them in, by the rule connectors are read by.
A call names a row as `<instance>/<id>`, and the kind gets the row with its instance.

## What was built

- [`code://packages/sdk/src/types/lists.ts`](../../../../packages/sdk/src/types/lists.ts) - `ListInstance`, `instance` on a row and a query, and `addInstance` and `removeInstance` on the handle.
- [`code://packages/sdk/src/plugins/plugins.ts`](../../../../packages/sdk/src/plugins/plugins.ts) - the handle's two calls and their checks.
- [`code://packages/sdk/src/lists/channel.ts`](../../../../packages/sdk/src/lists/channel.ts) - each instance asked, the row keys and the owner rule.
- The same file - the `instance` query, the instances in the snapshot, and the actions when one comes or goes.

## Verified

- `list-instances.test.ts` runs 6 cases: one row id in two instances, the owner rule, an operation, a read, and an instance that comes and goes.
- `list-connector-instances.test.ts` runs 1 case: a connector that opens and closes.
- The sdk and server suites pass, with `pnpm typecheck`, `pnpm build` and `pnpm docs:build`.

## Departures from the plan

- An instance id may not hold a slash, so a row id may, where the plan refused a row id with one.
- In an instance list a create answers its row as `<instance>/<id>`.
- A row read for a live action is read with no reader, and each subscriber's view is filtered by its instance's owner.

## Left for later

- An instance whose connector changes owner keeps the old owner until it opens again.
