---
title: A device names its transport
status: todo
depends: []
layer: push plugin
refs:
  - "[code://packages/push/src/provider.ts#L87-L154](../../../../packages/push/src/provider.ts#L87-L154) - the records and the body schema"
  - "[code://packages/push/src/plugin.ts#L290-L320](../../../../packages/push/src/plugin.ts#L290-L320) - the routing by `platform`"
---

## Objective

A device record has an optional `transport`, `expo` or `webpush`, and the plugin picks the sender from it.
`platform` says only what the device is, and a phone may be reached by Web Push.

## Files

- `UPDATE: packages/push/src/provider.ts:87-154` - adds `Transport`, the optional `transport` on both records, `ios` and `android` on a Web Push record, and `transportOf`.
- `UPDATE: packages/push/src/plugin.ts:290-320` - groups the audience by `transportOf`, not by `platform`.
- `UPDATE: packages/push/test/provider.test.ts` - the write cases for `transport`.
- `UPDATE: packages/push/test/plugin.test.ts` - the routing cases.
- `UPDATE: packages/push/README.md` - the body rules in *The `push:` scheme* name `transport`.
- `UPDATE: docs/updates/v0_16.md` - one line under *Push* in the unreleased part.

## Steps

1. Add `export type Transport = 'expo' | 'webpush'` in `provider.ts`.
2. Add an optional `transport` to `ExpoDevice` with `'expo'`, and to `WebDevice` with `'webpush'`.
3. Widen `WebDevice.platform` to `'web' | 'ios' | 'android'`.
4. Add `transport` to `EXPO_BODY` with `enum: ['expo']`, and to `WEB_BODY` with `enum: ['webpush']`.
5. Widen the `platform` enum of `WEB_BODY` to `web`, `ios` and `android`.
6. Add `transportOf(device)`, which answers `device.transport`, or `expo` for a `token` and `webpush` for an `endpoint`.
7. Keep a written `transport` on the stored record, and store none when the write names none.
8. Change `phones` and `browsers` in `plugin.ts` to filter on `transportOf`.
9. Name the two groups `expo` and `webpush` in the code, since a Web Push group now holds phones.
10. Write the README rules, and the update line for 0.16.

## Validation

- `provider.test.ts`: the provider keeps a write with `transport: "webpush"`, `platform: "android"` and an endpoint.
- `provider.test.ts`: the provider refuses `transport: "expo"` with `platform: "web"` with `-32602`.
- `provider.test.ts`: the provider refuses `transport: "expo"` with an endpoint, and `transport: "webpush"` with a token, with `-32602`.
- `provider.test.ts`: a record with no `transport` reads back with none, and `transportOf` answers from its fields.
- `plugin.test.ts`: the Web Push sender gets an `android` record with an endpoint, and the Expo sender gets nothing.
- `plugin.test.ts`: the Expo sender gets an `android` record with a token and no `transport`, as today.
- `pnpm vitest run packages/push` passes.

## Resume
