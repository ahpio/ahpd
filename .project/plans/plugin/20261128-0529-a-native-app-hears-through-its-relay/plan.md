---
title: A native app hears through its relay
domain: plugin
status: active
priority: medium
created: 2026-11-28
revalidated: 2026-11-28
requires:
  - plans/plugin/20261124-2310-bots-and-push-change-by-commands-only/plan.md
refs:
  - git://aa56b0656 - the last commit that holds the brief `briefs/a-native-app-hears-through-its-relay.md` and the problem `problems/setting-web-push-hosts-removes-the-browser-services.md`
  - https://github.com/ahpio/ahpd/issues/500 - Hostline's request, and the relay design its author chose
  - "[code://packages/push/src/provider.ts#L87-L116](../../../../packages/push/src/provider.ts#L87-L116) - the two device records, `ExpoDevice` and `WebDevice`"
  - "[code://packages/push/src/provider.ts#L119-L154](../../../../packages/push/src/provider.ts#L119-L154) - the write's body schema, two closed `oneOf` alternatives"
  - "[code://packages/push/src/plugin.ts#L156-L158](../../../../packages/push/src/plugin.ts#L156-L158) - `webPushHosts` replaces the default list"
  - "[code://packages/push/src/plugin.ts#L290](../../../../packages/push/src/plugin.ts#L290) - a device that is not `web` goes to Expo"
  - "[code://packages/push/src/plugin.ts#L309](../../../../packages/push/src/plugin.ts#L309) - a `web` device goes by Web Push"
  - "[code://packages/push/src/send.ts#L45-L46](../../../../packages/push/src/send.ts#L45-L46) - `RETRY_WAITS_MS`, the fixed waits this plan makes an option"
  - "[code://packages/push/src/send.ts#L119-L141](../../../../packages/push/src/send.ts#L119-L141) - the Expo sender's retry loop, the rule both senders share"
  - "[code://packages/push/src/webpush.ts#L191-L267](../../../../packages/push/src/webpush.ts#L191-L267) - `createWebSender`, one request per device and no retry"
  - "[code://packages/push/package.json#L84-L98](../../../../packages/push/package.json#L84-L98) - the options schema"
  - "[code://packages/push/i18n/pt.json#L6-L16](../../../../packages/push/i18n/pt.json#L6-L16) - the option descriptions in Portuguese, and `es.json` beside it"
  - "[code://scripts/dev-issuer.mjs](../../../../scripts/dev-issuer.mjs) - the dev script the test relay copies the shape of"
  - https://unifiedpush.org/developers/spec/android/ - UnifiedPush AND_3.1.0, Web Push to native Android apps
  - https://www.rfc-editor.org/rfc/rfc8030 - Web Push, the request a relay accepts
  - https://www.rfc-editor.org/rfc/rfc8291 - the `aes128gcm` message encryption
  - https://www.rfc-editor.org/rfc/rfc8292 - VAPID
---

## Goal

A native app, such as Hostline, gets push notifications from ahpd through its own relay, with no Expo SDK.
The relay speaks Web Push, so the host sends to it as it sends to a browser.
Expo phones, browsers and every relay app work side by side on one host.
A device record says what the device is and how the host reaches it, as two fields.
A failed send is retried on waits the operator sets, and a retry whose session moved on is dropped.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `git diff --name-only origin/main...<branch> -- packages/push` over every `origin` and `maycxc` branch and every worktree - none change `packages/push` at `aa56b0656`.
- `rg "platform === 'web'" packages/push/src` - the two routing lines in `plugin.ts`.
- `rg "RETRY_WAITS_MS|post\(" packages/push/src/send.ts` - one send with the waits, and one receipt read with none.
- `rg "webPushHosts" packages/push` - the option, its default, its schema row and its two catalogs.

### Runtime path

```
session status -> plugin notify -> audience -> transport of each device
  expo    -> createSender     -> Expo push API -> APNs or FCM
  webpush -> createWebSender  -> browser push service, or an app's relay -> FCM or APNs
each failed request -> shared retry on retryWaits -> dropped when the session moved
```

### Gaps

- The sender is picked from `platform`, so a phone reached by Web Push goes to Expo.
- A Web Push send has no retry.
- The Expo waits are a constant.
- An operator who allows a relay drops the browser push services.
- No test receives a real Web Push request and opens it.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A relay speaks Web Push, and ahpd sends to it as to a browser | Softov, 2026-11-28, chose "Relay speaks Web Push" | 01, 04 |
| A record says how the host reaches it in a second field beside `platform` | Softov, 2026-11-28: "we split platform for device kind. and add another for the channel of communication" | 01 |
| The field is `transport`, with `expo` and `webpush` | Softov, 2026-11-28, chose "transport" | 01 |
| A record with no `transport` is `expo` with a `token` and `webpush` with an `endpoint` | `(defaulted: the two shapes stored today, so no migration)` | 01 |
| A `webpush` record takes `ios`, `android` or `web`, and an `expo` record `ios` or `android` | `(defaulted: Expo reaches phones only)` | 01 |
| Web Push sends retry | Softov, 2026-11-28, chose "Include retries" | 02 |
| `retryWaits` is one list of waits in seconds, and its length is the number of retries | Softov, 2026-11-28, chose "One list of waits" | 02 |
| One `retryWaits` serves both senders | Softov, 2026-11-28, chose "One option for both" | 02 |
| `retryWaits` defaults to `[1, 2]`, and `[]` means no retry | `(defaulted: today's Expo waits, so a host that sets nothing sees no change)` | 02 |
| A retry is dropped when its session's status moved since the first try | Softov, 2026-11-28, chose "Drop a stale retry" | 02 |
| The Expo receipt read keeps no retry | `(defaulted: it has none today, and a missing receipt is a log line)` | 02 |
| A `relayHosts` option adds hosts to `webPushHosts`, which keeps its meaning | Softov, 2026-11-28, chose "New relayHosts option" | 03 |
| The test relay is `scripts/dev-relay.mjs`, a dev script and not a package | `(defaulted: dev-issuer.mjs is the pattern)` | 04 |
| The test relay takes its certificate as files, and its usage gives the `openssl` line | `(defaulted: Node makes no certificate)` | 04 |
| Per-device topics and push connectors wait in an idea | Softov, 2026-11-28, chose "In the idea" | - |

## Proposed architecture

- **Data flow** - a device record carries `platform` and an optional `transport`. `transportOf(device)` answers the stored one, or the one its fields imply. The plugin groups the audience by `transportOf`.
- **Event flow** - unchanged. A status move calls `notify`, and `notify` hands each group to its sender.
- **State flow** - each send call takes `due()`, which the plugin answers from its session list. A retry calls `due()` first and stops when it answers false.
- **Layer responsibilities** - `provider.ts`: the record, the schema, `transportOf` and the host check. `retry.ts`: the one retry rule. `send.ts` and `webpush.ts`: one request each, retried through `retry.ts`. `plugin.ts`: the options and the routing.
- **Source-of-truth files** - [`code://packages/push/src/provider.ts`](../../../../packages/push/src/provider.ts), [`code://packages/push/src/plugin.ts`](../../../../packages/push/src/plugin.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - a device names its transport](task-01-a-device-names-its-transport.md) | done | - |
| [02 - push retries take a list of waits](task-02-push-retries-take-a-list-of-waits.md) | done | 01 |
| [03 - relay hosts keep the browsers](task-03-relay-hosts-keep-the-browsers.md) | done | - |
| [04 - a dev relay opens each message](task-04-a-dev-relay-opens-each-message.md) | done | 01, 03 |

## Risks and tradeoffs

- A client that sends `transport` to a host before this plan is refused `-32602`, because the old schema is closed. The README says to send it only where the host's schema has it.
- A long wait in `retryWaits` holds a send that long. The stale check limits what a late retry can tell.
- A daemon that stops drops the retries still waiting. The README says so, as it says of Expo receipts.

## Resume state

- **Done so far:** all four tasks, 2026-11-28. See [implemented.md](implemented.md).
- **Next action:** the review.
- **Open questions:** none.
- **Watch out for:** ahpapp and ahpw send no `transport`, so the inference must keep every stored and new record of theirs on its sender today.

## Final verification checklist

- [ ] The push suite and the whole suite pass.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm docs:build` passes.
- [ ] `scripts/dev-relay.mjs` against a test daemon prints the notification of a session that needs input.
- [ ] With the relay answering 410, the device leaves `push://devices`.
- [ ] ahpw registers a browser and gets a notification on a host that sets `relayHosts`.
