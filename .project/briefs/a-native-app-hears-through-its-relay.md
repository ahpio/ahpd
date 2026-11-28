---
title: A native app hears through its relay
created: 2026-11-28
refs:
  - git://22f6768da - the commit of ahpd the facts were checked at
  - https://github.com/ahpio/ahpd/issues/500 - Hostline's request, and the relay design its author chose
  - "[code://packages/push/src/provider.ts#L87-L116](../../packages/push/src/provider.ts#L87-L116) - the two device records, `ExpoDevice` and `WebDevice`"
  - "[code://packages/push/src/provider.ts#L119-L154](../../packages/push/src/provider.ts#L119-L154) - the write's body schema, two closed `oneOf` alternatives"
  - "[code://packages/push/src/provider.ts#L426](../../packages/push/src/provider.ts#L426) - an endpoint must be `https:`"
  - "[code://packages/push/src/plugin.ts#L290](../../packages/push/src/plugin.ts#L290) - every device whose platform is not `web` is sent to Expo"
  - "[code://packages/push/src/plugin.ts#L309](../../packages/push/src/plugin.ts#L309) - every device whose platform is `web` is sent by Web Push"
  - "[code://packages/push/src/webpush.ts#L115-L127](../../packages/push/src/webpush.ts#L115-L127) - `vapidHeader`, the ES256 JWT with `aud`, `exp` and an optional `sub`"
  - "[code://packages/push/src/webpush.ts#L191-L267](../../packages/push/src/webpush.ts#L191-L267) - `createWebSender`, one request per device and no retry"
  - "[code://packages/push/src/send.ts#L45-L46](../../packages/push/src/send.ts#L45-L46) - `RETRY_WAITS_MS`, the Expo sender's waits"
  - "[code://packages/push/src/send.ts#L119-L141](../../packages/push/src/send.ts#L119-L141) - the Expo sender's retry on the network, a 429 or a 5xx"
  - "[code://packages/push/test/webpush.test.ts#L124](../../packages/push/test/webpush.test.ts#L124) - the send tests answer from a stub, and nothing opens a sealed message"
  - "[code://scripts/dev-issuer.mjs](../../scripts/dev-issuer.mjs) - the dev script a test relay copies the shape of"
  - https://unifiedpush.org/developers/spec/android/ - UnifiedPush AND_3.1.0, Web Push to native Android apps through a distributor
  - https://docs.expo.dev/push-notifications/sending-notifications/ - Expo's push service, which holds the app's FCM and APNs credentials
  - https://www.rfc-editor.org/rfc/rfc8030 - Web Push, the request a relay accepts
  - https://www.rfc-editor.org/rfc/rfc8291 - the `aes128gcm` message encryption
  - https://www.rfc-editor.org/rfc/rfc8292 - VAPID, how the host proves itself to a push service
---

# A native app hears through its relay

Softov wants a native app, such as Hostline, to get push notifications from ahpd with no Expo SDK.
The app's author runs a relay that holds the app's FCM and APNs credentials.
The relay speaks Web Push, so ahpd sends to it as it sends to a browser.
Every app keeps working beside the others on one host: Expo phones, browsers, Hostline, and the next app with its own relay.

## What others do

- **Expo** runs one push service for every Expo app. The app's author gives Expo the FCM and APNs credentials, and a sender posts JSON with an Expo token. ahpd's Expo sender follows this.
- **UnifiedPush** gives a native Android app a Web Push endpoint through a distributor. AND_3.1.0 says the message "MUST be an encrypted content that follows [RFC8291]". The app gives the VAPID public key at registration. A message is 1 to 4096 bytes. An FCM-backed distributor exists. This brief follows the same model.
- **A browser's push service** accepts RFC 8030 requests and checks the RFC 8292 VAPID header. It answers 404 or 410 for a subscription it no longer knows.

## What ahpd has today

- A Web Push record carries `platform: "web"`, an `endpoint` and `keys`. An Expo record carries `platform` `ios` or `android` and a `token`.
- The body schema has two closed alternatives. A field that neither names is refused `-32602`.
- The plugin picks the sender from `platform`. A record that is not `web` goes to Expo, whatever it holds.
- A Web Push send seals `{ title, body, data: { uri, kind } }` with `aes128gcm`. It sends `TTL`, `Urgency`, a per-session `Topic` header and a VAPID `Authorization` header.
- A 404 or 410 answer removes the device. Any other failure is a log line, with no retry.
- The Expo sender retries after 1 s and 2 s on the network, a 429 or a 5xx.
- An endpoint must be `https:` on a host in `webPushHosts`.
- Setting `webPushHosts` removes the browser push services: [setting-web-push-hosts-removes-the-browser-services.md](../problems/setting-web-push-hosts-removes-the-browser-services.md).
- No test receives a real Web Push request and opens it.
- A Hostline relay needs no ahpd change to work: it registers as `platform: "web"`, and the operator allows its host.

## Who writes

- No branch on `origin` or `maycxc`, and no worktree of `/github/ahpd`, changes `packages/push` at `22f6768da`.
- ahpapp writes Expo records, and ahpw writes `web` records. Both send no `transport`, so both keep working.
- Hostline writes records from outside the repository. It may send `transport` only to a host whose schema has it, because an older host refuses the field.
- `docs/plugins/push.md` includes the push README, so a README change is a docs change.

## The change

- A device record has a `transport`: `expo` or `webpush`. `platform` says only what the device is: `ios`, `android` or `web`.
- A record with no `transport` is read as `expo` when it has a `token`, and `webpush` when it has an `endpoint`. Stored records need no migration.
- A `webpush` record may have any of the three platforms. An `expo` record has `ios` or `android`.
- The plugin picks the sender from `transport`, never from `platform`.
- A Web Push send retries as the Expo sender does, on the network, a 429 or a 5xx. The rule is written once and shared by both senders.
- A plugin option, `retryWaits`, is the list of waits in seconds before each retry, for both senders. Its length is the number of retries, and `[]` means no retry.
- The default of `retryWaits` is `[1, 2]`, the waits of `RETRY_WAITS_MS` today, so a host that sets nothing keeps today's Expo behaviour.
- A later retry rule, such as jitter or `Retry-After`, takes an object form of the same option.
- An operator allows a relay's host without removing the browser push services. This fixes [setting-web-push-hosts-removes-the-browser-services.md](../problems/setting-web-push-hosts-removes-the-browser-services.md).
- The push README has a section for a relay author. It says what a request carries and what a relay answers. It says how to check the VAPID header against the key the app registered.
- A dev script, `scripts/dev-relay.mjs`, is a test relay. It makes device keys, registers through `x-ahpd/push/put`, and serves its endpoint over HTTPS. It checks the VAPID header and opens each message. It answers 201, or 410 or 500 when a flag says so.

## Open points

- Which fix the problem takes. Its candidates are in its *Fix* section.
