---
title: VS Code main parity after AHP 1.1.0
created: 2026-11-21
refs:
  - git://e751bfe5b - the commit of ahpd the facts were checked at
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - VS Code main on 2026-11-21, read from the 1.145.2 tag `c4453f8ea430` on, past Pass 8
  - git://github.com/microsoft/agent-host-protocol@e36b0a20 - AHP main on 2026-11-19, after v1.1.0
  - "[code://packages/sdk/src/access/permissionrules.ts#L73-L87](../../packages/sdk/src/access/permissionrules.ts#L73-L87) - `matchesPermissionRule`, with no `Mcp` case"
  - "[code://packages/sdk/src/host/permissions.ts#L78-L85](../../packages/sdk/src/host/permissions.ts#L78-L85) - `mcpServerOf`, the MCP server a call's tool belongs to"
  - "[code://packages/sdk/src/host/spawn.ts#L626-L632](../../packages/sdk/src/host/spawn.ts#L626-L632) - the request the approval chain reads"
  - "[code://packages/sdk/src/sessions/changes.ts#L1291-L1299](../../packages/sdk/src/sessions/changes.ts#L1291-L1299) - Create PR pushes to `origin` when the branch has no upstream"
  - "[code://packages/sdk/src/vscoderootconfig.ts#L492-L499](../../packages/sdk/src/vscoderootconfig.ts#L492-L499) - `clientOwnedApprovalRootConfigKeys`"
  - "[code://packages/sdk/src/sessions/changes.ts#L1438](../../packages/sdk/src/sessions/changes.ts#L1438) - a turn's changeset under the session URI"
  - "[plans/host/117-ahpd-speaks-ahp-1-1-0/plan.md](../plans/host/117-ahpd-speaks-ahp-1-1-0/plan.md) - the move to the 1.1.0 package"
  - "[briefs/the-rest-of-ahp-1-1-0.md](the-rest-of-ahp-1-1-0.md) - the 1.1.0 additions this brief leaves to it"
---

# VS Code main parity after AHP 1.1.0

Softov wants ahpd to match what VS Code really ships and what the protocol really says, to correct behaviour and to add missing features. A review of VS Code main after UPSTREAM.md Pass 8 found the items below, which no plan, brief or pass tracks. Softov chose on 2026-11-21 to build the first three groups and keep the fourth for later.

## What others do

VS Code's agent host at main `ddbdd50a9ed1` is the reference for every item. The commits named are VS Code's.

## What ahpd has today

### Small fixes

- **`Mcp` permission rules**. VS Code `0ad0170ab342` matches `Mcp`, `Mcp(<server>)` and `Mcp(<server>/<tool>)` rules (`common/permissionRules.ts`). It reads a request's `mcpServerName` and `mcpToolName`. In ahpd, `matchesPermissionRule` has `Shell`, `WebFetch`, `Read` and `Edit` only ([`code://packages/sdk/src/access/permissionrules.ts#L73-L87`](../../packages/sdk/src/access/permissionrules.ts#L73-L87)). The host already knows a call's MCP server, by `mcpServerOf` ([`code://packages/sdk/src/host/permissions.ts#L78-L85`](../../packages/sdk/src/host/permissions.ts#L78-L85)).
- **The push remote of Create PR**. VS Code `1808c5c2a55e` pushes to the branch's push remote first. Then it takes the remote of the GitHub repository, preferring `origin`, then `origin`, then the only remote. In ahpd, a branch with no upstream goes to `origin` ([`code://packages/sdk/src/sessions/changes.ts#L1291-L1299`](../../packages/sdk/src/sessions/changes.ts#L1291-L1299)).
- **Root config keys**. VS Code main declares ten keys that ahpd does not. They are `keepAwakeWhileWorking`, `sessionModelOptions`, `chatResources`, `hooksEnabled`, `mcpSkillsEnabled`, `mcpSkillsServerApprovals`, `extensionPermissionApprovals`, `mcpGalleryServiceUrl`, `browserUseEnabled` and `assistedApprovalInstructions`. The host still declares `migrateLegacyCopilotCliEnabled`, which VS Code main no longer has.

### Session tool options

- `create_session` takes `reasoningEffort` and `contextTier` while `sessionModelOptions` is not `off` (`node/shared/sessionServerTools.ts` L135-L192).
- `add_artifact_or_reference` takes `mode`, `pinned` or `aboveInput`, while `chatResources` is on (`node/shared/artifactServerTools.ts` L47-L53).
- The host's tools take neither.

### Host liveness and keep-awake

- **Ping**. VS Code's host pings a silent client every 10 s and closes its transport after 20 s more (`node/protocolServerHandler.ts` L153-L154, L860-L865). AHP 1.1.0 has `ping` from client to server only, so this is VS Code's own extension. The host sends no ping.
- **Keep-awake**. VS Code's host holds the machine awake while a chat works, and lets go 2 minutes after the last one stops (`node/agentHostKeepAwake.ts` L18). It runs `caffeinate -i -w <pid>`, `systemd-inhibit --what=idle`, or PowerShell (`node/agentHostPowerSaveBlocker.ts` L115-L126), as `keepAwakeWhileWorking` says. The host has nothing of the kind.

### Later

- **AHP 1.2.0 automations**. AHP main adds `AutomationDefinition.target` and the one-time trigger `AutomationOneTimeTrigger`. VS Code main advertises `oneTime` and `targets.previousSession`. The host's own `_meta.ahpd.session` with `pinnedSession` maps onto `target`. Planned on 2026-11-21 in [host/20261121-0821-an-automation-runs-once-at-a-set-time](../plans/host/20261121-0821-an-automation-runs-once-at-a-set-time/plan.md) and [host/20261121-0821-an-automation-continues-a-session-or-a-chat](../plans/host/20261121-0821-an-automation-continues-a-session-or-a-chat/plan.md).
- **Remote worktree cleanup**. VS Code main serves `vscode/sessionWorktreeCleanup`, `vscode/prepareSessionWorktreeCleanup`, `vscode/listManagedWorktrees` and `vscode/cleanupManagedWorktree` (`common/agentHostWorktreeCleanup.ts`). The host serves none of them.
- **Turn changesets under the chat**. VS Code main serves `<chatUri>/changeset/turn/<turnId>` (`common/changesetUri.ts`), and its window still reads the session form. The host serves `turn/{turnId}` under the session ([`code://packages/sdk/src/sessions/changes.ts#L1438`](../../packages/sdk/src/sessions/changes.ts#L1438)).
- **New `vscode/*` methods.** The Dev Container environment methods, `vscode/answerShellAuthentication`, and the GitHub environment and proxy methods of the window. Most are Copilot's.

## Who writes

- **ahpd main**. PR #397, host/117, changes `host.ts`, `routing.ts`, `snapshots.ts` and `channels.ts`, so each plan from this brief starts after it merges.
- **MayCXC's fork**. No fork branch newer than 2026-11-02 is waiting to merge.

## The change

- A permission rule `Mcp`, `Mcp(<server>)` or `Mcp(<server>/<tool>)` matches a call of that MCP server or tool.
- Create PR pushes a branch with no upstream to the remote VS Code chooses, and names that remote's owner as the head owner.
- The root schema declares VS Code main's ten new keys and drops `migrateLegacyCopilotCliEnabled`.
- `create_session` and `add_artifact_or_reference` take VS Code's new options behind their keys.
- The host pings a silent client and closes it when it does not answer.
- The host keeps the machine awake while a chat works, as `keepAwakeWhileWorking` says.
