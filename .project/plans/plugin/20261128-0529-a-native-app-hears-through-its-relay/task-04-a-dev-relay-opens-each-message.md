---
title: A dev relay opens each message
status: todo
depends:
  - task-01-a-device-names-its-transport.md
  - task-03-relay-hosts-keep-the-browsers.md
layer: scripts and docs
refs:
  - "[code://scripts/dev-issuer.mjs](../../../../scripts/dev-issuer.mjs) - the dev script shape: one file, a usage comment, Node alone"
  - "[code://packages/push/src/webpush.ts#L67-L127](../../../../packages/push/src/webpush.ts#L67-L127) - the sealing and the VAPID header the relay checks"
  - "[code://packages/push/test/webpush.test.ts#L47-L90](../../../../packages/push/test/webpush.test.ts#L47-L90) - the RFC 8291 and VAPID checks the relay repeats"
  - "[code://docs/sdk/AUTHENTICATION.md#L215](../../../../docs/sdk/AUTHENTICATION.md#L215) - where the dev issuer is documented"
---

## Objective

`scripts/dev-relay.mjs` is a test relay.
It registers a device on a daemon, receives each Web Push request, checks it, and prints the notification it opens.
The push README tells a relay author what a request carries and what to answer.

## Files

- `CREATE: scripts/dev-relay.mjs` - the test relay.
- `UPDATE: packages/push/README.md` - a section for a relay author, and how to run the test relay.
- `UPDATE: docs/updates/v0_16.md` - one line under *Push*.

## Steps

1. Write the usage comment first, with the `openssl` line that makes a loopback certificate.
2. Take the daemon's URL and token, the HTTPS port, and the certificate and key files as flags.
3. Make a P-256 key pair and a 16-byte `auth` secret with `node:crypto`.
4. Connect to the daemon with `ws`, and read `push://vapid`.
5. Register `{ transport: "webpush", platform: "android", endpoint, keys }` with `x-ahpd/push/put`.
6. Serve `https://localhost:<port>/d/<id>` with `node:https`.
7. Check that the header's `k` is the key from `push://vapid`, and verify the ES256 signature.
8. Check that `aud` is the relay's origin and that `exp` is in the future.
9. Answer 401 when a check fails, and print which one.
10. Open the `aes128gcm` body with the device keys, and print the JSON with `TTL`, `Urgency` and `Topic`.
11. Answer 201, or 410 or 500 when the `--answer` flag says so.
12. Remove the device with `x-ahpd/push/remove` when the script stops, unless it answered 410.
13. Write the README section: the request, the header check, the body, the 404 and 410 rule, and the retries.
14. Write how to run the relay: `relayHosts: ["localhost"]` and `NODE_EXTRA_CA_CERTS` on the daemon.

## Validation

- Run a test daemon with `relayHosts: ["localhost"]` and `NODE_EXTRA_CA_CERTS`, as isolated as the XDG rule says.
- Run `node scripts/dev-relay.mjs` against it, and make a session that needs input.
- The relay prints `{ title, body, data: { uri, kind: "needsInput" } }` and `Urgency: high`.
- Run it with `--answer 410`, and check that the device leaves `push://devices`.
- Run it with `--answer 500`, and check that the daemon log shows the retries of `retryWaits`.
- `pnpm docs:build` passes.

## Resume
