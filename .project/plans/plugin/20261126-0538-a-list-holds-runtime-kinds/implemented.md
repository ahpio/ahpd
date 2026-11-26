---
title: A list holds runtime kinds - implemented
date: 2026-11-26
refs:
  - "[code://packages/sdk/src/lists/channel.ts](../../../../packages/sdk/src/lists/channel.ts) - start, stop, the row's process and the close"
  - "[decisions/a-runtime-kind-starts-only-when-asked.md](../../../decisions/a-runtime-kind-starts-only-when-asked.md) - why the host starts no row by itself"
---

A kind of class `runtime`, such as a process-compose service, holds records of something that runs.
A person starts a row with `<kind>/start`, and it runs as a process until `<kind>/stop`.
The row carries its current process and how it is going.
The host starts no row by itself, and stops every running row when it closes.
A create or update that writes a live field is refused.

## What was built

- [`code://packages/sdk/src/types/lists.ts`](../../../../packages/sdk/src/types/lists.ts) - `start` and `stop` on `ListKind`.
- [`code://packages/sdk/src/plugins/validate.ts`](../../../../packages/sdk/src/plugins/validate.ts) - a runtime kind needs `start`, `stop` and `processes`, and `start` and `stop` are the host's ids.
- [`code://packages/sdk/src/lists/channel.ts`](../../../../packages/sdk/src/lists/channel.ts) - the two operations, their offers, the row's `process`, the live-field check and `close`.
- [`code://packages/sdk/src/lists/processes.ts`](../../../../packages/sdk/src/lists/processes.ts) - `abort`, `lifecycleOf` and a hook at each report.
- [`code://packages/sdk/src/plugins/plugins.ts`](../../../../packages/sdk/src/plugins/plugins.ts) - a closer for each list with runtime kinds.

## Verified

- `list-runtime.test.ts` runs 5 cases: nothing starts by itself, start and stop, the live field, the close, and the checks.
- The sdk and server suites pass, with `pnpm typecheck`, `pnpm build` and `pnpm docs:build`.

## Departures from the plan

- A row's live state is its process's lifecycle, kept in memory while the host runs it. The plan named `status` and `url` as live fields; a kind sets those in its own record.
- `start` and `stop` are reserved for every kind, not only runtime kinds.

## Left for later

- A restart forgets which row runs: every row reads as stopped until a person starts it, by the decision.
