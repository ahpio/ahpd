---
title: A native app hears through its relay - implemented
date: 2026-11-28
refs:
  - "[code://packages/push/src/provider.ts](../../../../packages/push/src/provider.ts) - `transport`, `transportOf` and the write rules"
  - "[code://packages/push/src/retry.ts](../../../../packages/push/src/retry.ts) - the one retry rule"
  - "[code://packages/push/src/plugin.ts](../../../../packages/push/src/plugin.ts) - the routing, `retryWaits`, `relayHosts` and `due`"
  - "[code://scripts/dev-relay.mjs](../../../../scripts/dev-relay.mjs) - the test relay"
---

A device record says what the device is in `platform` and how the host reaches it in `transport`, and the plugin sends by `transport`.
A phone whose app has a Web Push relay registers as `android` or `ios` with an endpoint, and gets its notifications through that relay.
Both senders retry on the plugin's `retryWaits`, and a retry whose session moved on is not sent.
`relayHosts` allows a relay's host and keeps the browser push services.
`scripts/dev-relay.mjs` registers a device, checks each request as a relay does, and prints the notification it opens.

## What was built

- [`code://packages/push/src/provider.ts`](../../../../packages/push/src/provider.ts) - `Transport`, `isWebPush` and `transportOf`, and the optional `transport` on both records. A Web Push record takes any of the three platforms, and the write and read rules check `transport`.
- [`code://packages/push/src/retry.ts`](../../../../packages/push/src/retry.ts) - `retrying`, `worthRetrying`, `waitsOf` and the default `RETRY_WAITS`.
- [`code://packages/push/src/send.ts`](../../../../packages/push/src/send.ts) - the Expo send retries through `retry.ts`, on the waits it is given, and asks `due` before each retry. `RETRY_WAITS_MS` is gone.
- [`code://packages/push/src/webpush.ts`](../../../../packages/push/src/webpush.ts) - each Web Push request retries through `retry.ts`. A 404 or a 410 is never retried.
- [`code://packages/push/src/plugin.ts`](../../../../packages/push/src/plugin.ts) - the `expo` and `webpush` groups by `isWebPush`, `retryWaits` with its warning, `relayHosts`, and `due` from the session list.
- [`code://packages/push/package.json`](../../../../packages/push/package.json) and the two catalogs - the `relayHosts` and `retryWaits` options in English, Portuguese and Spanish.
- [`code://scripts/dev-relay.mjs`](../../../../scripts/dev-relay.mjs) - the test relay.
- [`code://packages/push/README.md`](../../../../packages/push/README.md) - the `transport` table, the two option rows, the retry rule, and *A relay* with *The test relay*.
- [`code://docs/updates/v0_16.md`](../../../../docs/updates/v0_16.md) - four lines under *Push* in 0.16.0-rc.2.

## Verified

- The push suite: 7 files, 79 cases, with `retry.test.ts` new and transport, retry and allow list cases in the other four.
- `plugin-load.test.ts` and `server-configure.test.ts`: 121 cases, after the push option list gained the two options.
- `pnpm test:unit` once: 9875 cases passed, 32 skipped, none failed.
- `pnpm typecheck`, `pnpm boundary`, `pnpm sdk-range`, `pnpm i18n`, `tools/schema.mjs`, `pnpm build` and `pnpm docs:build` pass.
- By hand, a test daemon on port 9287 with its own `XDG_CONFIG_HOME`, the echo fixture and push from this branch, with `relayHosts: ["localhost"]` and `NODE_EXTRA_CA_CERTS`:
  - The relay registered `transport: "webpush"`, `platform: "android"`, checked the VAPID header, and printed `{ title: "Session: hello relay", body: "Completed in ahpd.", data: { uri, kind: "idle" } }` with `TTL 2419200` and `Urgency normal`.
  - With `--answer 500`, the relay got requests at 0 s, 1 s and 3 s, and the daemon logged one warning.
  - With `--answer 410`, the relay got one request, and the device left `push-devices.json`.
  - The relay removed its device when it stopped, unless it had answered 410.

## Departures from the plan

- The plan's *Risks and tradeoffs* says an older host refuses `transport`. It ignores it, and refuses a phone with an endpoint for its missing token. The README says to check the `push` manifest for `transport` before registering a Web Push phone.
- A body with a `token` and an `endpoint` and no `transport` was an Expo phone before, with the endpoint ignored. It is a Web Push body now, and is refused for its token.
- The plugin case for a stale retry is in `send.test.ts`, whose helpers drive the plugin on fake timers, not in `plugin.test.ts`.
- `packages/server/test/plugin-load.test.ts` changed: it lists each first-party plugin's options.
- The relay sends its commands with `channel: "ahp-root://"`, as the host's tests send them.
- The run by hand told a completed session, not one that needs input: the echo backend never asks. The plugin cases cover `needsInput` and `Urgency: high`.
- The ahpw check in *Final verification checklist* is by hand: [push-relay-checks.md](../../../pending/push-relay-checks.md).

## Left for later

- Per-device topics and push connectors: [the idea](../../../ideas/push-reaches-devices-through-connectors-and-topics.md).
