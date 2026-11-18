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

1. Read the plan's *Answers* table, and its *Resume state*, which names where the build went past the plan.
2. Run `gh pr diff <PR> -R ahpio/ahpd`, and read it against the task's *Steps*.
3. Read the check named in the plan's section here. Pass: what it says holds in the diff. Fail: say what differs, and I fix it in a new PR.
4. Say "close <plan id>" when it passes. I then write `implemented.md` and set the plan to `built`.

## host/20261118-1043, #377, a person's restriction

1. Check that `APPROVAL_KEYS` in `packages/sdk/src/access/personrules.ts` holds `autoApprovePolicyRestricted`.
2. Check that every read of the key takes the owner's value: `setting(...)` twice in `spawn.ts`, and `approvalSetting(...)` in `chatactions.ts` and the start policy.
3. Check that `chatactions.ts` passes `undefined` in place of a client's `host_policy`.
4. Read the result of the manual check in *Manual checks*.

## plugin/20261118-1103, #378, a push device

1. Check that `session_opened` carries `owner` in `packages/sdk/src/types/events.ts`.
2. Check that `routing.ts` keys an opening by session, client and owner, so a second person under one client id is raised again.
3. Check that `byClient` in `packages/push/src/plugin.ts` compares the device's owner with the opener's, and with the session owner for a creator.

## host/20261118-1104, #379, the wake cap

1. Check that `runOne` in `packages/sdk/src/host/automations.ts` calls `request(..., true)` in place of `fly`.
2. Check the queue case in `plugin-triggers.test.ts`: it checks that the later asks start nothing while a run goes. The fixture's run never ends, so the held run is not seen to start.

## daemon/20261118-1105, #380, a refused plugin

1. Check that `refusedId` in `packages/server/src/plugins.ts` drops the scope, as you chose: `@ahpd/agent-claude` is `agent-claude`.
2. Check that both `unimportedId` and the loader use it.
3. Check that `idParam` in `pluginschannel.ts` takes a row's own id with a `/`, and still refuses `?`.
4. The problem `a-plugin-that-does-not-resolve-has-an-id-with-a-slash.md` stays open for a URL id with a `?`. Say if it should close.

## plugin/20261118-1106, #381, the tunnel retry

1. Check that a 401 in `start` in `packages/tunnel-devtunnel/src/kind.ts` sets a timer, 30 s doubling to 10 min, and waits on `onHold`.
2. Check that a run, a stop, a removal, another error and the plugin's close each clear the timer.
3. Check that the row's error names the time of the next try.

## container/20261118-1107, #382, a removed node

1. Check that `drop` in `packages/sdk/src/nodes.ts` closes each session socket of the node, and that a control socket that closes by itself does not.
2. Check that `node rm` and `node add` in `packages/server/src/commands/nodes.ts` go to the running daemon only with no `--users` and no `--config-file`.
3. Check that `tokenIn` and `API_PREFIX` now come from `paths.ts`, and that `plugin.ts` lost its own copy of `tokenIn`.
4. Read the result of the manual check in *Manual checks*.

## container/20261118-1108, #383, a disposed session

1. Check that the branch for a session not held in `packages/sdk/src/host/lifecycle.ts` reads the config before `kept.forget`, and calls `ctx.leaveForgotten` after.

## Manual checks

Run by the agent on the test daemon, `ws://127.0.0.1:39200`, at main after #383. The results go here.
