---
title: An external session is imported - implemented
date: 2026-11-22
refs:
  - "[code://packages/sdk/src/host/vscodemethods.ts](../../../../packages/sdk/src/host/vscodemethods.ts)"
  - "[code://packages/sdk/src/host/history.ts](../../../../packages/sdk/src/host/history.ts)"
  - "[code://packages/sdk/src/host/catalogue.ts](../../../../packages/sdk/src/host/catalogue.ts)"
---

A client can now make an external session this host's own without sending it a turn: `vscode/importSession {session, takeOver?}` restores the session, reads a loaded session's turns again so a transcript another program wrote since is shown, gives the default chat's draft the model the backend restored, adopts the session, and answers `{session}`. The method is advertised in `_meta` and gated by `session:create`.

## What was built

- [`packages/sdk/src/host/vscodemethods.ts`](../../../../packages/sdk/src/host/vscodemethods.ts) - `vscode/importSession`: the URI and `takeOver` checks, the restore, the reload of a loaded session, the model offered to the draft, the owner recorded on adoption, and the answer. An unknown session is refused with `Session not found`; a session owned by somebody else is refused with `PermissionDenied` to a caller who is neither that owner nor holds `session:*`.
- [`packages/sdk/src/host/history.ts`](../../../../packages/sdk/src/host/history.ts) - `History.loaded(id)` and `History.reloadSession(id)`. The reload waits on a read already in flight, evicts the cached turns through `evictSessionState`, reads the transcript again with `restoreSession`, and replaces a held default chat's turns with `chat/truncated` then `chat/turnsLoaded`. A chat running a turn is not replaced under it: the request is answered and the replacement lands when the turn ends.
- [`packages/sdk/src/host/catalogue.ts`](../../../../packages/sdk/src/host/catalogue.ts) - `adoptExternalSession` records the backend that listed the session as its provider and keeps the name the host holds it by, so a later listing does not find an adopted session external again.
- [`packages/sdk/src/host/gate.ts`](../../../../packages/sdk/src/host/gate.ts) - `vscode/importSession` needs `session:create`.
- [`packages/sdk/src/host/handshake.ts`](../../../../packages/sdk/src/host/handshake.ts) - `_meta` carries `vscode.importSession: true`.
- [`packages/sdk/test/session-import.test.ts`](../../../../packages/sdk/test/session-import.test.ts) - the adoption, the reload with a turn written since, the wait for a running turn, the unknown session, and the two-user refusal.
- [`packages/sdk/test/users-gate-tables.test.ts`](../../../../packages/sdk/test/users-gate-tables.test.ts) - the served-method count is 65.

## Verified

- `pnpm typecheck` passes.
- `pnpm boundary` passes, no undeclared dependency in any package.
- `packages/sdk/test/session-import.test.ts` was written but not run here: the sdk vitest suite is the owner's to run under the lock, along with the rest of the sdk suite.

## Departures from the plan

- The ownership check runs after the session is found, so an unknown session is refused with `Session not found` on every host. A session nobody owns yet may be claimed by any caller holding `session:create`; one owned by somebody else is refused.
- With no model on the restored turns, the draft is left as it was rather than cleared.
- `adoptExternalSession` now records the provider and the held name. Without them, a store's `external: false` is nothing it keeps, so a later listing would find the session external again.
- The reload's wait for a running turn is asynchronous: the import is answered as VS Code answers it, and the replacement lands when the chat is quiet.
- `takeOver` is checked to be a boolean and otherwise unused, as the plan decided.

## Left for later

- `vscode/stageCreateSessionImportChunk`, which the plan gives its own plan at `host/20261121-2250-a-session-is-created-from-a-conversation`.
