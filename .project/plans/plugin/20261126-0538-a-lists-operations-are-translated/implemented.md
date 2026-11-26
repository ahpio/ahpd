---
title: A list's operations are translated - implemented
date: 2026-11-26
refs:
  - git://be2935b97 - the operations onto kinds this was built on
  - "[code://packages/sdk/src/lists/channel.ts](../../../../packages/sdk/src/lists/channel.ts) - `inLocale`, the words of one operation for a reader"
---

A list's kinds and operations reach each reader in their language.
A kind's title and description, and its own operations, are read in the catalogs of its plugin.
An added operation is read in the catalogs of the plugin that added it.
The host translates update and remove, and names the kind in the remove question.
`ahpd.channels` is read in the connection's locale.

## What was built

- [`code://packages/sdk/src/lists/channel.ts`](../../../../packages/sdk/src/lists/channel.ts) - `inLocale`, used by `kinds` and `listOperations`.
- [`code://packages/sdk/src/host/root.ts`](../../../../packages/sdk/src/host/root.ts) and [`code://packages/sdk/src/host/handshake.ts`](../../../../packages/sdk/src/host/handshake.ts) - `ahpd.channels` in the connection's locale.
- [`code://packages/sdk/src/plugins/plugins.ts`](../../../../packages/sdk/src/plugins/plugins.ts) - each kind and added operation carries its plugin's catalogs.
- `packages/sdk/src/i18n/pt.json` and `es.json` - the host's words at `operations.list`.

## Verified

- `list-i18n.test.ts` runs 2 cases: Portuguese with a word no catalog has, and English with no locale.
- The sdk suite runs 5412 cases and the server suite 2006, with no failure.
- `pnpm typecheck`, `pnpm build` and `pnpm docs:build` pass.

## Departures from the plan

- The snapshot and the `operations` actions send ids and statuses only, so they have no words to translate.
- The remove question in Portuguese and Spanish has no article, so it fits a kind of either gender.

## Left for later

- A list's own title and description, and its filters, are still English.
