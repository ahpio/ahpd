---
title: A client that joins a session removed the plugins of another client from its list
status: open
date: 2026-11-23
severity: major
blocks: []
refs:
  - "[code://packages/sdk/src/host/tooling.ts#L1263-L1317](../../packages/sdk/src/host/tooling.ts#L1263-L1317) - `reconcile`, which runs when the clients of a session move"
  - "[code://packages/sdk/src/host.ts#L1101-L1115](../../packages/sdk/src/host.ts#L1101-L1115) - `dispatch`, which lays the client half on every `session/customizationsChanged`"
  - "[code://packages/sdk/test/client-plugins-session.test.ts#L467](../../packages/sdk/test/client-plugins-session.test.ts#L467) - the harness that a test for this case uses"
  - git://fcef83870 - main, where a test does not reproduce the problem
---

## Symptom

Seen on 2026-11-23 with the dev ahpd, in the session `ahp-session:/59e2355d-b370-4e6c-af2b-2bd686472531`.

1. VS Code is an active client of the session and announces five plugins.
2. A second client sends `session/activeClientSet` with one tool and no plugins.
3. A snapshot of the session has no plugin in `customizations`.
4. `activeClients` still lists the five plugins under VS Code.

The dev daemon loaded its code before the checkout moved 119 commits forward to `git://fcef83870`.

## Cause

Unknown.
On `git://fcef83870`, a test in the harness of `client-plugins-session.test.ts` does not reproduce it: the plugin of the first client stays.
`dispatch` lays the client half on every `session/customizationsChanged`, so `reconcile` does not drop it there.
The daemon that showed the problem can run code from before a change that fixed it.

## Impact

Every client of the session shows no plugins of another client, and the agent can lose them.

## Workaround

Make VS Code announce its plugins again, for example by switching a plugin off and on.

## Fix

- Restart the dev daemon on `git://fcef83870` or later, and repeat the symptom with a second client.
- When it does not happen again, delete this file.
- When it happens again, record the wire and add a failing case to `client-plugins-session.test.ts`.
