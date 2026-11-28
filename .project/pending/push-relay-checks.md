---
title: Check a browser and a relay on one host with relayHosts
plans:
  - plans/plugin/20261128-0529-a-native-app-hears-through-its-relay/plan.md
---

# Check a browser and a relay on one host with relayHosts

plugin/20261128-0529 adds `relayHosts`, and a browser must still register beside a relay.

## Set up

1. Make a scratch folder, and a loopback certificate in it with the `openssl` line in the push README's *The test relay*.
2. Write `config.json` there with `@ahpd/push` and `"options": { "relayHosts": ["localhost"] }`, beside an agent plugin.
3. Start a test daemon: `XDG_CONFIG_HOME=<scratch>/xdg NODE_EXTRA_CA_CERTS=<scratch>/relay-cert.pem ahpd --port 39310 --config-file <scratch>/config.json --sessions memory --automations memory --no-update-check`.
4. Start ahpw against `ws://127.0.0.1:39310`, on a port that is not 5180.

## The browser registers

1. Turn notifications on in ahpw.
2. Pass: `push://devices` lists the browser. Fail: ahpw shows an error, or the daemon log says the endpoint's host is not allowed.

## The relay registers beside it

1. Run `node scripts/dev-relay.mjs --daemon ws://127.0.0.1:39310 --cert <scratch>/relay-cert.pem --key <scratch>/relay-key.pem` from the ahpd checkout.
2. Pass: the relay prints `registered dev-relay`, and `push://devices` lists both devices.

## Both are told

1. Run a turn in ahpw, and close the tab before it ends.
2. Pass: the browser shows the notification, and the relay prints the same `title` and `body`.
3. Fail: one of the two shows nothing. Read the daemon log for a line that names its device.
