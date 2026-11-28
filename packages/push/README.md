# @ahpd/push

[![npm](https://img.shields.io/npm/v/%40ahpd%2Fpush)](https://www.npmjs.com/package/@ahpd/push)
[![CI](https://github.com/ahpio/ahpd/actions/workflows/ci.yml/badge.svg)](https://github.com/ahpio/ahpd/actions/workflows/ci.yml)
![license MIT](https://img.shields.io/badge/license-MIT-blue)
![node >=22](https://img.shields.io/badge/node-%3E%3D22-5fa04e)
![Agent Host Protocol 1.1.0](https://img.shields.io/badge/AHP-1.1.0-0b7285)

[ahpio.com](https://ahpio.com) · [Docs](https://ahpio.github.io/ahpd/)

Push notifications for the [`@ahpd/server`](https://www.npmjs.com/package/@ahpd/server) daemon. A phone registers its Expo push token, a browser registers its Web Push subscription, and a native app registers the Web Push endpoint of its own relay. Each hears about a session that needs a person while the app or the tab is closed.

It is two halves. A `push:` resource provider keeps the registered devices. The plugin is VS Code's sessions window notifier, carried to a phone or a browser: a client of the daemon that holds its session list and tells a person's devices when one of their sessions needs them, completes or fails.

Part of [ahpd](https://github.com/ahpio/ahpd). The source is in [`packages/push`](https://github.com/ahpio/ahpd/tree/main/packages/push).

## Install

```bash
ahpd plugin install @ahpd/push
ahpd restart
```

Update, remove and one-run flags such as `--plugin` are in [Plugins](https://github.com/ahpio/ahpd/blob/main/docs/server/PLUGINS.md).

## Options

In the configuration file, with every option set:

```json
{
  "plugins": [
    "@ahpd/agent-claude",
    {
      "name": "@ahpd/push",
      "grants": ["session:list"],
      "options": {
        "accessToken": { "$secret": "host:expo" }
      }
    }
  ]
}
```

No option is required. A daemon that names none still pushes, without an access token.

On a daemon where people sign in, the plugin's entry grants `session:list`, which is how the plugin reads the sessions the daemon already holds when it starts. Without it, the plugin says once in the log that the list could not be read, and tells only the sessions made after the daemon started. A daemon where nobody signs in gates nothing, and needs no grant.

| Option | Default | What it does |
| --- | --- | --- |
| `accessToken` | none | An Expo access token, where the project has push security on. Given here as a `{ "$secret": "<name>" }`, the vault is read at each send rather than at load |
| `webPushHosts` | `*.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com` | The hosts a browser's endpoint may be at. A pattern of `*.<domain>` matches every host under that domain. An endpoint at another host is refused at the write |
| `relayHosts` | none | The hosts of the Web Push relays an operator allows, such as a native app's. They are added to `webPushHosts`, so the browser push services stay allowed. A pattern of `*.<domain>` matches as it does there |
| `contact` | none | A `mailto:` or `https:` URI sent as the VAPID `sub` claim, which a push service may use to contact the operator |
| `retryWaits` | `[1, 2]` | The seconds to wait before each retry of a send that failed, for Expo and for Web Push alike. One retry for each entry, so `[2, 30, 90]` retries three times, and `[]` sends no retry |

`accessToken` is `writeOnly`, so reading the options back answers `<set>` rather than the token, and `secretAtUse`, so the name in `{ "$secret": ... }` reaches the plugin unresolved and is read with `host.secret` when a send happens. A name the vault does not hold fails that send, with one line in the log and nothing else.

`webPushHosts` and `relayHosts` are checked when a device registers, not at each send. The default list is the push services of Safari, Chrome, Firefox and Edge. A device whose endpoint is elsewhere is refused. The endpoint comes from the client, and an open list would let it aim the host at any address. A relay goes in `relayHosts`, because setting `webPushHosts` replaces the browser push services.

`contact` is sent on every request when it is given. Apple's push service may insist on a `sub` claim, so a host that pushes to Safari should set one.

## The `push:` scheme

A device is addressed by its install id, which is the URI path:

| Command | What it does |
| --- | --- |
| `resourceWrite push://devices/<id>` | Registers a device, replacing what the id held |
| `resourceRead push://devices/<id>` | The record, as JSON, without its credential: no token, and for a browser no endpoint or keys |
| `resourceResolve push://devices/<id>` | Its size and its `etag`. A device that is not there is refused `-32008`. No `mtime` or `ctime` is answered, because the file keeps no times |
| `resourceList push://devices` | The registered device ids |
| `resourceDelete push://devices/<id>` | Unregisters. A device that is not there is refused `-32008` |

The body is JSON. `platform` says what the device is: `ios`, `android` or `web`. `transport` says how the host reaches it: `expo` or `webpush`.

| `transport` | `platform` | Fields |
| --- | --- | --- |
| `expo` | `ios` or `android` | a non-empty `token`, the device's Expo push token |
| `webpush` | `web`, `ios` or `android` | an `endpoint` and `keys: { p256dh, auth }`, the fields of a subscription's `toJSON()` |

`transport` is optional. A body without it is `webpush` when it has an `endpoint` or its platform is `web`, and `expo` otherwise, so a client that sends none keeps working. A body whose fields do not fit its `transport`, such as an `expo` browser or a `webpush` body with a token, is refused `-32602`. A host before 0.16 ignores `transport` and refuses a phone with an endpoint, so a client checks that the `push` manifest in `_meta.ahpd.resourceProviders` names `transport` before it registers one. A phone reached by `webpush` is one whose app has a relay: see [A relay](#a-relay).

`lang` is optional, a BCP 47 tag such as `pt-BR` that the device's notifications are worded in. `audience` is optional, `person` or `device`, which sessions the device hears about. A body that is neither is refused `-32602`. The person a device belongs to is the one the writing connection is signed in as, and its client the id that connection gave at `initialize`; the body names neither.

A `webpush` device's `endpoint` must be an `https:` URL on a host that `webPushHosts` or `relayHosts` allows. A write with another endpoint is refused `-32602`. The endpoint and the keys are never read back, because an endpoint is a capability URL to the device. A write with `createOnly` against an id that is already there is refused `-32010`. A write whose `ifMatch` is not the device's `etag` is refused `-32011`, and so is one with an `ifMatch` naming an id that is not there. A URI of another scheme is refused `-32602`.

`push://` and `push://devices` are directories, and nothing below `push://devices/<id>` names anything. A write or a delete of either is refused `-32009`.

A device is its person's. A write or a delete of a device another person registered is refused `-32009`. The holder of `*:*`, the root connection and a host with no users may change any device.

### Commands and the channel

| Command | Params | Grant |
| --- | --- | --- |
| `x-ahpd/push/put` | `{ id, record, createOnly?, ifMatch? }` | `push:put` |
| `x-ahpd/push/remove` | `{ id }` | `push:delete` |

Each runs the same write or delete as the resource call, with the same refusals. `record` is the body a write takes. Both answer `{}`.

`x-ahpd-push://` lists the caller's own devices as `{ records }`, each `{ id, record }` with the record a read answers, then `x-ahpd-push/added`, `x-ahpd-push/changed` and `x-ahpd-push/removed`. Every signed-in person may subscribe without a grant, and a holder of `push:read` sees only their own devices too. `resourceWrite` and `resourceDelete` on `push://devices` are refused from 0.16, and the message names the command.

### `push://vapid`

`push://vapid` is one read-only record, `{ "publicKey": "<base64url>" }`. It is the host's VAPID public key, which a browser passes as `applicationServerKey` when it subscribes. The key pair is made at the first load and kept in `push-vapid.json`, written `0600`. A host with no pair refuses the read `-32008`, and a write or delete against it is refused `-32009`.

A registration needs `push:put` and a removal `push:delete`, and `push:write` holds both. The built-in `member` role holds `push:write`, and `guest` does not, so a guest cannot register. A role of the host's own names `push:write` to let its people register. A client finds out whether a host can push from `_meta.ahpd.resourceProviders`, the same way it finds `computer`.

## What a notification says

The words are those of VS Code's sessions window notifier, in the language the device registered with: Portuguese and Spanish from the plugin's catalogs, and English otherwise.

| | |
| --- | --- |
| Title | `Session: <title>`, the session's title, or `Session` and the first eight characters of its id when it has none |
| Body | `Attention needed.` when it needs a person, `Session completed.` when it completes, `Session failed.` when it fails; `Attention needed in <workspace>.`, `Completed in <workspace>.` or `Failed in <workspace>.` when it has a workspace, its project's name or its first folder's |
| Data | `{ uri: <session>, kind }`, which the app reads to open the session. `kind` is VS Code's notification kind: `needsInput`, or `idle` for a session that completed or failed |

A notification never repeats what the session is asking. The text passes through Expo's service or a browser's push service, and sits on a lock screen. A prompt belongs in neither.

## When a session is told

The plugin watches each session's status as VS Code's sessions window reads it: needing input over running over failed, and completed for anything else. Waiting on a client running a tool is not needing input, because the daemon's status leaves it out.

- A move into needing input or into failure is told at once.
- A move into completed is told a second and a half later, and only if the session is still completed then. A queued turn that starts in between is told nothing.
- Any move drops a completed notice still to come.
- The status a session is listed or added at is where it starts, and is not told. A second request while a session already needs input is not a move, and sends nothing.

## Which devices are told

Each device chooses with its `audience`. A `person` device, which is one that says nothing, hears every session of its person, as VS Code's window tells its user: on a daemon where people sign in, the sessions whose owner registered it, and on a daemon where nobody signs in, every session, its one person's. A `device` device hears only the sessions its own client created or opened. Every device also hears the sessions its own client created or opened, whoever's they are. On a daemon where people sign in, that is a session its own person created or opened through that client: a client id is the client's own word, so a device that gives another person's id hears nothing of that person's sessions.

## How a notification is sent

A device's notification goes by its `transport`.

An `expo` device's goes to Expo's push service, a hundred messages to a request. Expo answers a ticket for each message, and the plugin reads the tickets' receipts fifteen minutes after the send, as Expo recommends. A ticket with no receipt by then is a line in the log too. A daemon that stops within those fifteen minutes reads none of that send's receipts.

A `webpush` device's is one request to its endpoint: a browser's push service, or an app's relay. A push service keeps the message for four weeks while the browser is not connected, the web-push library's default.

A request that fails on the network, or that is answered with a 429 or a 5xx, is sent again after each wait of `retryWaits`: by default after one second and then after two more, as Expo asks a sender to back off. One still failing then is a line in the daemon's log. A 404 or a 410 is never retried. Before each retry the plugin checks the session: a session that moved on during the wait, such as one a person already answered, gets no retry, and the log says so. A daemon that stops drops the retries still waiting.

## A relay

A native app that does not use Expo reaches its phones through a relay its author runs. The relay holds the app's FCM and APNs credentials and speaks Web Push, so this host sends to it as it sends to a browser. This is the model of UnifiedPush on Android.

The app makes its own `p256dh` key pair and 16-byte `auth` secret, reads this host's VAPID public key from `push://vapid`, and gets an endpoint from its relay. It registers `{ "transport": "webpush", "platform": "android", "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }`, or `ios`, with `x-ahpd/push/put`. The operator adds the relay's host to `relayHosts`.

What the relay receives, one `POST` to the endpoint for each notification:

| | |
| --- | --- |
| `Authorization` | `vapid t=<JWT>, k=<the host's public key>`, RFC 8292. The JWT is ES256, its `aud` the relay's origin and its `exp` twelve hours on, with a `sub` when the host sets `contact` |
| `Content-Encoding` | `aes128gcm`. The body is sealed for the device's keys, RFC 8291, so the relay cannot read it |
| `TTL` | `2419200`, four weeks |
| `Urgency` | `high` when a session needs a person, `normal` when it completed or failed |
| `Topic` | One value for each session, so a relay that holds an undelivered notice can replace it with the newer one |
| Body | Once opened by the app, `{ "title", "body", "data": { "uri", "kind" } }`, as *What a notification says* describes. A few hundred bytes, under the 4 KB that FCM and APNs carry |

What the relay checks and answers:

- The `k` in the header is the host key the app registered the endpoint for, and the signature verifies with it. `aud` is the relay's own origin, and `exp` has not passed. A relay that refuses answers 401 or 403, which the host logs and does not retry.
- 201 when it took the message. The relay forwards the sealed body as it is, such as base64 in an FCM data message. On iOS the app opens it in a notification service extension, with `mutable-content` set.
- 404 or 410 when it no longer knows the endpoint, or FCM or APNs says the token is gone. The host removes the device at once.
- 429 or a 5xx when it is busy or down. The host retries on `retryWaits`.

### The test relay

`scripts/dev-relay.mjs` is a relay to try this path with, and forwards nothing. It registers a device on a daemon, checks each request as a relay does, opens it and prints the notification. `--answer 410` or `--answer 500` makes it refuse, to watch the host remove the device or retry.

```bash
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 7 \
  -subj /CN=localhost -addext subjectAltName=DNS:localhost \
  -keyout relay-key.pem -out relay-cert.pem
NODE_EXTRA_CA_CERTS=relay-cert.pem ahpd     # with "relayHosts": ["localhost"] in this plugin's options
node scripts/dev-relay.mjs --cert relay-cert.pem --key relay-key.pem
```

The script's opening comment lists its flags.

## Where devices are kept

One file, `push-devices.json`, under the daemon's configuration directory, written whole and read when the daemon starts. It is written `0600`, because a push token or a subscription is a credential to that device's notifications.

The VAPID pair is in `push-vapid.json`, beside it, and written the same way. A host that loses that file makes a new pair, and every subscription made with the old key fails until each browser subscribes again.

A device Expo answers `DeviceNotRegistered` for, in a ticket or a receipt, is removed: the token has been retired, and a message sent there is wasted from then on.

A browser's push service answers 404 or 410 for an endpoint it no longer knows. That device is removed too: the subscription is gone, and the browser has to subscribe again.

A push service sees which host talks to which browser, and when. The message is sealed for the browser, but the traffic is not hidden from the service that carries it.

## Documentation

| | |
| --- | --- |
| [PLUGINS.md](https://github.com/ahpio/ahpd/blob/main/docs/plugins/PLUGINS.md) | Writing and loading a plugin, and the events a plugin may watch |
| [GET-STARTED.md](https://github.com/ahpio/ahpd/blob/main/docs/server/GET-STARTED.md) | Running the daemon |

## License

MIT © Softov
