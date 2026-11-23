---
title: A session's changes have one key, and a new folder is read at once - implemented
date: 2026-11-23
refs:
  - "[code://packages/sdk/src/types/changes.ts](../../../../packages/sdk/src/types/changes.ts) - `ChangesetSource`, whose `session` is now documented as the session id"
  - "[code://packages/sdk/src/host/spawn.ts](../../../../packages/sdk/src/host/spawn.ts) - the backend start reads the session's folder"
---

The changes of a session are found under one name. The "This Session" changeset holds a file that a shell command wrote, beside the files the tools wrote. A folder with no git has counts. A session in a folder the daemon has not read offers its Uncommitted Changes as it starts, before a turn ends.

## What was built

- [`code://packages/sdk/src/types/changes.ts`](../../../../packages/sdk/src/types/changes.ts) - every `session` a source is handed is the session's id.
- [`code://packages/sdk/src/host/spawn.ts`](../../../../packages/sdk/src/host/spawn.ts) - `observe`, `propose`, `settle` and `complete` take the id; the backend start reads the folder after the baseline.
- [`code://packages/sdk/src/host/changesets.ts`](../../../../packages/sdk/src/host/changesets.ts), [`code://packages/sdk/src/host/snapshots.ts`](../../../../packages/sdk/src/host/snapshots.ts), [`code://packages/sdk/src/host/actions.ts`](../../../../packages/sdk/src/host/actions.ts), [`code://packages/sdk/src/host/catalogue.ts`](../../../../packages/sdk/src/host/catalogue.ts), [`code://packages/sdk/src/host/resourcemethods.ts`](../../../../packages/sdk/src/host/resourcemethods.ts) - `scopes`, `state`, `operations`, `review`, `chatSummary` and the source's `invoke` take the id.

## Verified

- `changes-refresh.test.ts`: three new cases, a shell-written file in "This Session", counts with no git, and Uncommitted Changes before a turn ends. Each fails without the change.
- `chat-changesets.test.ts` and `users-gate-sessions.test.ts` now hand the port the id, as the host does.
- The sdk suite and the computer suite pass. `pnpm typecheck` passes.

## Departures from the plan

- The plan named `observe` and `state`. `propose`, `settle`, `complete`, `operations`, `review`, `chatSummary` and the source's `invoke` read the same tracker, so they take the id too.
- A changeset operation that a plugin contributed is still handed the session's URI, as before. Only the changes source moved to the id.
- Two tests stood in for the host with the URI. They now pass the id.
- The backend start reads the folder without `bringBackOf`, which task 02 copied from the turn's end. At the start the session has done no work, and the bring-back cost a read of the machine that `computer-disposable.test.ts` counts.

## Left for later

- None.
