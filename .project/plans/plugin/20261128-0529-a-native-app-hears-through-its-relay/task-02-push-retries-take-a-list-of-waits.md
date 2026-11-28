---
title: Push retries take a list of waits
status: done
depends:
  - task-01-a-device-names-its-transport.md
layer: push plugin
refs:
  - "[code://packages/push/src/send.ts#L45-L46](../../../../packages/push/src/send.ts#L45-L46) - `RETRY_WAITS_MS`, which goes"
  - "[code://packages/push/src/send.ts#L119-L141](../../../../packages/push/src/send.ts#L119-L141) - the retry loop this task moves to `retry.ts`"
  - "[code://packages/push/src/send.ts#L181](../../../../packages/push/src/send.ts#L181) - the receipt read, which keeps no retry"
  - "[code://packages/push/src/webpush.ts#L231-L259](../../../../packages/push/src/webpush.ts#L231-L259) - the one Web Push request"
  - "[code://packages/push/src/plugin.ts#L274-L277](../../../../packages/push/src/plugin.ts#L274-L277) - `notify` checks the status before it sends, which `due` repeats before a retry"
---

## Objective

Both senders retry a request on the network, a 429 or a 5xx, after each wait of `retryWaits`.
A retry is dropped when the session's status moved since the first try.

## Files

- `CREATE: packages/push/src/retry.ts` - the one retry rule: which answers are retried, the waits, and the `due` check.
- `UPDATE: packages/push/src/send.ts:45-46` - removes `RETRY_WAITS_MS`.
- `UPDATE: packages/push/src/send.ts:119-141` - `post` retries through `retry.ts`.
- `UPDATE: packages/push/src/webpush.ts:231-259` - the request retries through `retry.ts`, and 404 and 410 are never retried.
- `UPDATE: packages/push/src/plugin.ts` - reads `retryWaits`, gives it to both senders, and gives each send a `due`.
- `UPDATE: packages/push/package.json:84-98` - adds `retryWaits` to the options schema.
- `UPDATE: packages/push/i18n/pt.json` - the option's description in Portuguese.
- `UPDATE: packages/push/i18n/es.json` - the option's description in Spanish.
- `CREATE: packages/push/test/retry.test.ts` - the rule's cases.
- `UPDATE: packages/push/test/send.test.ts` - the Expo cases read the option.
- `UPDATE: packages/push/test/webpush.test.ts` - the Web Push retry cases.
- `UPDATE: packages/push/README.md` - the option row, and *How a notification is sent*.
- `UPDATE: docs/updates/v0_16.md` - one line under *Push*.

## Steps

1. Write `retrying(attempt, waits, due)` in `retry.ts`, with the loop from `send.ts` `post`.
2. Retry when the request throws, or answers 429 or a status of 500 or more.
3. Call `due()` before each retry, and stop with no request when it answers false.
4. Keep `waits` in milliseconds in the code, and convert the option from seconds where `plugin.ts` reads it.
5. Remove `RETRY_WAITS_MS`, and give `createSender` a `waits` option.
6. Keep the receipt read at `send.ts:181` with no retry.
7. Give `createWebSender` a `waits` option, and send each request through `retrying`.
8. Add an optional `due` argument to both `send` methods, which answers true when absent.
9. Read `retryWaits` in `plugin.ts` as a list of numbers of 0 or more, and fall back to `[1, 2]` otherwise.
10. Log one line when the operator sets `retryWaits` to a value that is not such a list.
11. Pass `due` from `notify` as `() => listed.get(session)?.status === status`.
12. Add `retryWaits` to the schema: an array of numbers, minimum 0, default `[1, 2]`.
13. Write its description in English, Portuguese and Spanish.
14. Write the README row, the retry rule, and that a stopping daemon drops the retries still waiting.

## Validation

- `retry.test.ts`: `[2, 30, 90]` makes three retries at those waits, on a fixed clock.
- `retry.test.ts`: `[]` makes one request and no retry.
- `retry.test.ts`: a 400 is not retried, and a 429, a 503 and a thrown request are.
- `retry.test.ts`: a `due` that answers false before the second retry stops the sends at two requests.
- `webpush.test.ts`: a 500 then a 201 sends once more and keeps the device.
- `webpush.test.ts`: a 410 is not retried and removes the device.
- `send.test.ts`: the Expo sender retries on the waits that the test gives it.
- `plugin.test.ts`: a session that moves out of needing input during a wait gets no retry.
- `pnpm vitest run packages/push` passes.

## Resume

Done 2026-11-28. See [implemented.md](implemented.md).
