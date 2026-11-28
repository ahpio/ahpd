---
title: Push reaches devices through connectors, and a device picks its topics
created: 2026-11-28
refs:
  - "[code://packages/push/src/plugin.ts#L243-L255](../../packages/push/src/plugin.ts#L243-L255) - the audience check, which a topic would narrow"
  - "[code://packages/push/src/provider.ts#L87-L116](../../packages/push/src/provider.ts#L87-L116) - the device records a connector transport would join"
  - "[code://docs/plugins/WEBHOOKS.md](../../docs/plugins/WEBHOOKS.md) - one connector for each sender, the shape a push connector copies"
  - https://github.com/ahpio/ahpd/issues/500 - Hostline's request, where direct credentials came up for self-built apps
---

An operator who holds an app's own FCM or APNs keys could keep each account as a connector.
The push plugin would register an `fcm` and an `apns` adapter, so one host serves the accounts of two or more apps.
Each account keeps its secrets in the vault, and has its state and alerts.
A device would name its app, a Firebase project or an APNs `bundleId`, and the host would pick the connector that serves it.
This is for self-built apps and for an app's author who runs ahpd; a store app keeps its relay.

A device could also register the topics it wants to hear.
One person hears only sessions, and another only automations.
Today the plugin tells three session moves and knows nothing of automations.
A topic for automations needs the plugin to know which sessions an automation made.
"Topic" here is the device's choice, not the Web Push `Topic` header.

The relay path comes first: [a-native-app-hears-through-its-relay.md](../briefs/a-native-app-hears-through-its-relay.md).
