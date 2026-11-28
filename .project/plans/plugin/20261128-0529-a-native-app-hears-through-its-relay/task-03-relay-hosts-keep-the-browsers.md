---
title: Relay hosts keep the browsers
status: done
depends: []
layer: push plugin
refs:
  - "[code://packages/push/src/plugin.ts#L156-L158](../../../../packages/push/src/plugin.ts#L156-L158) - `webPushHosts` replaces the default list"
  - "[code://packages/push/src/provider.ts#L47-L52](../../../../packages/push/src/provider.ts#L47-L52) - `WEB_PUSH_HOSTS`"
  - git://aa56b0656 - the last commit that holds the problem `problems/setting-web-push-hosts-removes-the-browser-services.md`
---

## Objective

An operator allows a relay's host with `relayHosts`, and the browser push services stay allowed.
`webPushHosts` keeps its meaning, so a host that sets it today sees no change.

## Files

- `UPDATE: packages/push/src/plugin.ts:156-158` - the allowed hosts are `webPushHosts`, or its default, and then `relayHosts`.
- `UPDATE: packages/push/package.json:84-98` - adds `relayHosts` to the options schema.
- `UPDATE: packages/push/i18n/pt.json` - the option's description in Portuguese.
- `UPDATE: packages/push/i18n/es.json` - the option's description in Spanish.
- `UPDATE: packages/push/test/plugin.test.ts` - the allow list cases.
- `UPDATE: packages/push/README.md` - the option row, and the endpoint rule in *The `push:` scheme*.
- `UPDATE: docs/updates/v0_16.md` - one line under *Push*.

## Steps

1. Read `relayHosts` as a list of non-empty strings, with the same filter as `webPushHosts`.
2. Give the provider `webPushHosts`, or its default, followed by `relayHosts`.
3. Match a `relayHosts` pattern as a `webPushHosts` pattern, `*.<domain>` included.
4. Add `relayHosts` to the schema: an array of strings, default `[]`.
5. Write its description in English, Portuguese and Spanish.
6. Write the README row, and say that a relay's host goes in `relayHosts`.

## Validation

- `plugin.test.ts`: with `relayHosts: ["push.relay.example"]`, a relay endpoint and a `fcm.googleapis.com` endpoint both register.
- `plugin.test.ts`: with `webPushHosts: ["a.example"]` and no `relayHosts`, only `a.example` registers, as today.
- `plugin.test.ts`: the provider refuses a host in neither list with `-32602`.
- `pnpm vitest run packages/push` passes.

## Resume

Done 2026-11-28. See [implemented.md](implemented.md).
