---
title: Push devices take commands and a channel
status: implemented
depends: []
layer: "push"
refs:
  - "[code://packages/push/src/provider.ts#L529-L558](../../../../packages/push/src/provider.ts#L529-L558) - the write and delete that get the owner check"
  - "[code://packages/sdk/src/resources/recordschannel.ts#L134](../../../../packages/sdk/src/resources/recordschannel.ts#L134) - the channel the push list is built on"
  - "[code://packages/bot/src/catalogue.ts#L104](../../../../packages/bot/src/catalogue.ts#L104) - an `authorize` that lets every reader in, as the push channel does"
---

## Objective

The push plugin serves `x-ahpd/push/put`, `x-ahpd/push/remove` and an `x-ahpd-push` channel of the caller's own devices.
A write or delete of another person's device is refused, through the commands and through `push://`.

## Files

- `UPDATE: packages/push/src/provider.ts:529-558` - the owner check on write and delete, and a `changed` callback after each.
- `CREATE: packages/push/src/channel.ts` - the `x-ahpd-push` channel and the two commands.
- `UPDATE: packages/push/src/plugin.ts:158` - register the channel and the commands beside the scheme.
- `UPDATE: packages/push/src/index.ts` - export the channel and the commands.
- `UPDATE: packages/push/package.json` - declare `x-ahpd-push` and the two commands in `contracts`.
- `CREATE: packages/push/test/push-commands.test.ts` - the commands, the channel and the owner check.
- `UPDATE: packages/push/test/plugin.test.ts` - the fake host gets `registerChannel` and `registerMethod`.
- `UPDATE: packages/push/test/send.test.ts` - the fake host gets `registerChannel` and `registerMethod`.

## Steps

1. Refuse a write or delete on a device whose `owner` is another person, with `-32009`, unless the caller holds `*:*` or is the root connection.
2. Let any caller change any device on a host with no users.
3. Call `changed` after each write and delete the store took.
4. Build the channel with `recordsChannel`, the device's shown record, `mayRead` on the device's owner and `mayReadEveryReader`.
5. Let every reader subscribe to `x-ahpd-push://`, as the bot channel's `authorize` does.
6. Make `put` take `{ id, record, createOnly?, ifMatch? }` and need `push:put`; make `remove` take `{ id }` and need `push:delete`.
7. Run both through the provider's `write` and `delete` on `push://devices/<id>`.
8. Register the channel and the commands in `plugin.ts`, and refresh the channel from `changed`.

## Validation

- `push-commands.test.ts`: a person's put and remove; another person's put and remove refused through the command and through `resourceWrite` and `resourceDelete`; a `*:*` holder may; the channel lists only the caller's devices with no token, endpoint or keys; a person without `push:read` subscribes.
- `pnpm --filter @ahpd/push test` passes.

## Resume

Built on 2026-11-16. A device kept before its owner was written down may be changed by anyone, as it was.

