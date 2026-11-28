---
title: Setting webPushHosts removes the browser push services
status: open
date: 2026-11-28
severity: minor
blocks: []
refs:
  - "[code://packages/push/src/plugin.ts#L156-L158](../../packages/push/src/plugin.ts#L156-L158) - the option replaces the default list when it is an array"
  - "[code://packages/push/src/provider.ts#L47-L52](../../packages/push/src/provider.ts#L47-L52) - `WEB_PUSH_HOSTS`, the push services of Safari, Chrome, Firefox and Edge"
  - "[code://packages/push/README.md#L52](../../packages/push/README.md#L52) - the option's row, which says the list is the allowed hosts"
  - git://22f6768da - main when the problem was read
---

## Symptom

Read from the code on 2026-11-28, and not reproduced.
An operator sets `"webPushHosts": ["push.relay.example"]` to allow an app's relay.
The relay's devices register.
A browser that registers next is refused `-32602`, because its push service is no longer in the list.

## Cause

`apply` reads `webPushHosts` as the whole list when it is an array.
`WEB_PUSH_HOSTS` is used only when the option is absent.
No option adds a host to the defaults.

## Impact

An operator who allows a relay, such as Hostline's, must copy the four browser hosts into the option.
An operator who does not copy them breaks every new browser registration on the host.
Browsers that registered before the change keep their records, and their sends still go.
The more relays exist, the more operators set the option, and the more hosts make this mistake.

## Workaround

Copy the four default hosts into `webPushHosts` beside the relay's host.

## Fix

Candidates, none chosen:

- A second option, such as `relayHosts`, whose hosts are added to `webPushHosts`.
- A marker in the list, such as `"default"`, that stands for the four browser hosts.
- The option always adds to the defaults, and a second option removes a default host.
