---
title: The fixes 0.15.0 waits for
date: 2026-11-18
---

# The fixes 0.15.0 waits for

Softov chose these nine problems on 2026-11-18, as [pending/release.md](../pending/release.md#left) says. Each goes through one of seven plans.

| Plan | Problems | Answer | Plan state |
| --- | --- | --- | --- |
| A person's restriction and answer stay their own | the push restriction and the `host_policy` answer | `autoApprovePolicyRestricted` is kept per person, as host/20261117-1047's keys are. Softov, 2026-11-18: "Per person, like #367's keys" | [host/20261118-1043-a-persons-restriction-stays-their-own](../plans/host/20261118-1043-a-persons-restriction-stays-their-own/plan.md), merged in #377 |
| A push device hears only its owner's openings | the push device and the client id | The client match checks the person who opened the session. Softov, 2026-11-18: "The person who opened it" | [plugin/20261118-1103-a-push-device-hears-only-its-owner](../plans/plugin/20261118-1103-a-push-device-hears-only-its-owner/plan.md), merged in #378 |
| A connector's wake counts against the cap | the webhook automation and the wake cap | (defaulted: the problem's one fix) | [host/20261118-1104-a-webhook-wake-counts-against-the-cap](../plans/host/20261118-1104-a-webhook-wake-counts-against-the-cap/plan.md), merged in #379 |
| A client updates a plugin that failed to load | the scoped plugin update | (defaulted: the problem's two steps) | [daemon/20261118-1105-a-plugin-that-failed-to-load-updates](../plans/daemon/20261118-1105-a-plugin-that-failed-to-load-updates/plan.md), merged in #380 |
| A tunnel refused at its start is tried again | the system tunnel retry | A start that failed with 401 is tried again after a delay, and again when the connector's token is refreshed. Softov, 2026-11-18: "Retry after a delay, and on refresh" | [plugin/20261118-1106-a-failed-system-tunnel-is-retried](../plans/plugin/20261118-1106-a-failed-system-tunnel-is-retried/plan.md), merged in #381 |
| A removed node is cut off at once | the running sessions of a removed node and `node rm` at the terminal | `ahpd node rm` goes to the running daemon when one is up. Softov, 2026-11-18: "Send it to the running daemon" | [container/20261118-1107-a-removed-node-is-cut-off-at-once](../plans/container/20261118-1107-a-removed-node-is-cut-off-at-once/plan.md), merged in #382 |
| A disposed session leaves its machine | the dispose of a session not held | (defaulted: read the config before the row is forgotten) | [container/20261118-1108-a-disposed-session-leaves-its-machine](../plans/container/20261118-1108-a-disposed-session-leaves-its-machine/plan.md), merged in #383 |
