---
title: Review the seven 0.15.0 fixes
plans:
  - plans/host/20261118-1043-a-persons-restriction-stays-their-own/plan.md
  - plans/plugin/20261118-1103-a-push-device-hears-only-its-owner/plan.md
  - plans/host/20261118-1104-a-webhook-wake-counts-against-the-cap/plan.md
  - plans/daemon/20261118-1105-a-plugin-that-failed-to-load-updates/plan.md
  - plans/plugin/20261118-1106-a-failed-system-tunnel-is-retried/plan.md
  - plans/container/20261118-1107-a-removed-node-is-cut-off-at-once/plan.md
  - plans/container/20261118-1108-a-disposed-session-leaves-its-machine/plan.md
---

# Review the seven 0.15.0 fixes

The seven plans merged on 2026-11-18 as #377 to #383, all green on `check` and `check-windows`. Each plan is `active` until you review it. Each new case was seen to fail with its fix taken out.

## How to review one

The agent checked on main at `2e81c97ea` that each fix is in the code. *Code checks* lists them. What is left is a read of the design.

1. Read the plan's *Answers* table. Each `(defaulted: ...)` row is a choice the agent made, which you may change.
2. Run `gh pr diff <PR> -R ahpio/ahpd`. Pass: you agree with how the change does what the plan says. Fail: say what to change, and the agent fixes it in a new PR.
3. Say "close <plan id>" when it passes. The agent then writes `implemented.md` and sets the plan to `built`.

| Plan | PR | Read for |
| --- | --- | --- |
| host/20261118-1043 | #377 | The Allow All refusal and a session's start policy also read the owner's value, past the plan's two reads in `spawn.ts`. |
| plugin/20261118-1103 | #378 | `session_opened` is raised again for a second person under one client id. |
| host/20261118-1104 | #379 | The queue case checks that later asks start nothing while a run goes, not that the held run starts. |
| daemon/20261118-1105 | #380 | The refused id drops the scope, as you chose. Say if `a-plugin-that-does-not-resolve-has-an-id-with-a-slash.md` should close: a URL id with a `?` is still refused. |
| plugin/20261118-1106 | #381 | Every record of the kind is tried again, not only the system tunnel, and the waits are a kind option, `retryMs`. |
| container/20261118-1107 | #382 | The node commands go to the daemon only with no `--users` and no `--config-file`, as `paths` does. |
| container/20261118-1108 | #383 | One call, `ctx.leaveForgotten`, in the branch for a session not held. |

## Code checks

Done by the agent on 2026-11-18 at `2e81c97ea`, each with `grep` on main. All passed.

| Plan | What was checked |
| --- | --- |
| host/20261118-1043 | `APPROVAL_KEYS` holds `autoApprovePolicyRestricted`. `spawn.ts` and `chatactions.ts` read the host's value nowhere. `spawn.ts` reads it with `setting` twice and `approvalSetting` once, and `chatactions.ts` with `approvalSetting`. A client's `host_policy` becomes `undefined`. |
| plugin/20261118-1103 | `SessionOpenedEvent` has `owner?`. `routing.ts` keys an opening by session, client and owner. The three `openedBy` calls pass `ownerFor(connection)`. `byClient` compares the opener's owner, or the session's for a creator. |
| host/20261118-1104 | `runOne` calls `request(..., true)` at `automations.ts:1399`, and no longer calls `fly`. |
| daemon/20261118-1105 | `refusedId` drops the scope, and `unimportedId` and the loader both call it. `idParam` takes a row's own id and refuses `?`. |
| plugin/20261118-1106 | A 401 sets a retry of 30 s up to 10 min and waits on `onHold`. A run, a stop, a removal and another error clear it, and so does the plugin's close. The error names the next try. |
| container/20261118-1107 | `drop` closes each session socket of the node. The commands forward only with no `--users` and no `--config-file`. `tokenIn` and `API_PREFIX` come from `paths.ts`, and `plugin.ts` has no copy of `tokenIn`. |
| container/20261118-1108 | The branch reads `kept.config` before `kept.forget`, and calls `ctx.leaveForgotten` after. |

## Manual checks

Run by the agent on the test daemon, `ws://127.0.0.1:39200`, at main after #383. The results go here.

Done on 2026-11-18 at `947f91721`. Both passed.

### host/20261118-1043, a person's restriction

alice and carol are admins. Each session had `autoApprove` on. The command was `python3 -c "print(41+1)"`, which the default terminal rules do not approve.

| Step | Seen | Result |
| --- | --- | --- |
| alice pushes `autoApprovePolicyRestricted: true`, then carol pushes `false` | `permissions/alice.json` holds `true`, `carol.json` holds `false`, and the root config is unchanged | pass |
| A turn in alice's session | The command asked | pass |
| A turn in carol's session | The command ran with no question | pass |
| alice pushes `false`, and a turn in her session | The command ran with no question | pass |

The client `host_policy` source was not checked by hand. A client sends it in `_meta` only, and its case in `host-permissions.test.ts` covers it.

### container/20261118-1107, a removed node

What it shows: `ahpd node rm` at the hub's terminal reaches the running daemon, and the daemon closes the node's connection and the session the node runs. Before #382, the command wrote the file only, and a node kept running its sessions.

The hub and the node both ran on this workstation, as two processes over the loopback. The hub was the test daemon, with `httpApi` on and the `computer` plugin. The node was `ahpd join` with its own XDG folders. A run with the node on another box is not done yet.

| Step | Seen | Result |
| --- | --- | --- |
| `ahpd node add box` at the terminal, with no daemon API | The file was written | pass |
| `ahpd node rm box`, with no daemon API | It said the running daemon was not told and the node stays until a restart, and the join kept running | pass |
| `ahpd node add box`, with the API | It said the change was made on the running daemon | pass |
| A session on `computer://node.box`, with one turn | The turn completed, and one `--stdio` host ran on the node | pass |
| `ahpd node rm box`, with the API | It said the token is refused and the connection is closed. The node's host stopped, and no `--stdio` host was left | pass |
| A turn in that session after the removal | It ended in `chat/error` | pass |
| The node joined again | The hub refused it | pass |
