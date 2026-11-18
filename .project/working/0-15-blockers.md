---
title: The fixes 0.15.0 waits for
date: 2026-11-18
---

# The fixes 0.15.0 waits for

Softov chose these nine problems on 2026-11-18, as [pending/release.md](../pending/release.md#left) says. Each goes through one of seven plans.

| Plan | Problems | Answer | Plan state |
| --- | --- | --- | --- |
| A push and an answer cannot speak for the host | [a-push-can-turn-off-the-auto-approval-restriction.md](../problems/a-push-can-turn-off-the-auto-approval-restriction.md), [a-client-names-its-own-answer-host-policy.md](../problems/a-client-names-its-own-answer-host-policy.md) | A push with a read-only key is refused, and an undeclared key is kept as now. Softov, 2026-11-18: "Refuse read-only, keep the rest" | not planned |
| A push device hears only its owner's sessions | [a-push-device-hears-sessions-by-client-id-alone.md](../problems/a-push-device-hears-sessions-by-client-id-alone.md) | (defaulted: the problem's one fix) | not planned |
| A webhook wake counts against the cap | [a-webhook-automation-skips-the-wake-cap.md](../problems/a-webhook-automation-skips-the-wake-cap.md) | (defaulted: the problem's one fix) | not planned |
| A client updates a plugin that failed to load | [a-client-cannot-update-a-scoped-plugin-that-failed-to-load.md](../problems/a-client-cannot-update-a-scoped-plugin-that-failed-to-load.md) | (defaulted: the problem's two steps) | not planned |
| A system tunnel that failed at start is retried | [a-system-tunnel-that-fails-at-start-is-not-retried.md](../problems/a-system-tunnel-that-fails-at-start-is-not-retried.md) | A start that failed with 401 is tried again after a delay, and again when the connector's token is refreshed. Softov, 2026-11-18: "Retry after a delay, and on refresh" | not planned |
| A removed node is cut off at once | [a-removed-node-keeps-serving-its-running-sessions.md](../problems/a-removed-node-keeps-serving-its-running-sessions.md), [node-rm-at-the-terminal-does-not-drop-a-joined-node.md](../problems/node-rm-at-the-terminal-does-not-drop-a-joined-node.md) | `ahpd node rm` goes to the running daemon when one is up. Softov, 2026-11-18: "Send it to the running daemon" | not planned |
| A disposed session leaves its machine | [a-disposed-session-not-held-leaves-its-machine.md](../problems/a-disposed-session-not-held-leaves-its-machine.md) | (defaulted: read the config before the row is forgotten) | not planned |
