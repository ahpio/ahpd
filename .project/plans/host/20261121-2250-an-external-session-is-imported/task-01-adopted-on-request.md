---
title: An external session is adopted on request
status: done
depends: []
layer: "sdk"
refs:
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `node/agentService.ts#L2599-L2660`, `importSession` and the turn replacement
---

## Objective

`vscode/importSession {session, takeOver?}` restores an external session, reads its turns again when they may be stale, and adopts it.

## Files

- `UPDATE: packages/sdk/src/host/vscodemethods.ts` - the method.
- `UPDATE: packages/sdk/src/host/history.ts` - the reload of a loaded session's turns, through `evictSessionState` and `restoreSession`.
- `UPDATE: packages/sdk/src/host/catalogue.ts` - the adoption on request.
- `UPDATE: packages/sdk/src/host/handshake.ts` - `vscode.importSession` in `_meta`.
- `UPDATE: packages/sdk/src/host/gate.ts` - `session:create` for the method.
- `UPDATE: packages/sdk/test/users-gate-tables.test.ts` - the method count.
- `CREATE: packages/sdk/test/session-import.test.ts` - the adoption, the reload and the refusal.

## Steps

1. Refuse a URI that is not a session the host knows.
2. Note whether the host had the session loaded, then restore it.
3. Read the default chat's turns again if the host had it loaded, and replace the held turns.
4. Wait for a running turn to end before the replacement.
5. Set the draft's model to the one the backend restored.
6. Adopt the session, and answer `{session}`.

## Validation

- `packages/sdk/test/session-import.test.ts` - an adoption, a reload with a new turn, and an unknown session.
- The sdk vitest suite passes.

## Resume

Implemented. `vscode/importSession` in `packages/sdk/src/host/vscodemethods.ts` parses `session`, checks the URI, restores the session, reads a loaded session's turns again, offers the restored model to the default chat's draft, records the owner, adopts the session, and answers `{session}`. `History` gained `loaded(id)` and `reloadSession(id)` in `packages/sdk/src/host/history.ts`; the reload evicts the cached turns, reads them again, and replaces a held chat's turns with `chat/truncated` then `chat/turnsLoaded`, waiting out a running turn without holding the request. `adoptExternalSession` in `packages/sdk/src/host/catalogue.ts` now also records the backend as the session's provider and keeps the name it is held by, so a later listing does not find the adopted session external again. The gate maps the method to `session:create`, `_meta` advertises `vscode.importSession`, and the served-method count is 65.

Four choices the task did not settle, each written into the code:

- **An unowned session may be claimed by any caller who holds `session:create`.** The task's ownership rule is the one a session's owner is held to, but a session nobody owns yet is exactly what an import is for, so the check refuses another person's session and lets a caller adopt an unowned one. It runs after the session is found, so an unknown session is always `Session not found`.
- **The model comes from the last restored turn that names one**, on its message where the backend wrote one and otherwise on its usage. A session whose last turn is a question has no model of its own, and with no model found the draft is left as it was.
- **The reload reads past a read already in flight.** A read that started before the reload carries the turns being replaced, so it is waited on and the read after it is the one asked again.
- **`takeOver` is accepted, checked to be a boolean, and otherwise unused**, as the plan decided.

Validation: `packages/sdk/test/session-import.test.ts` covers an adoption with no turn, a loaded session whose backend wrote a turn since, a replacement that waits for a running turn, an unknown session, and another person's session refused on a host with users. Typecheck and boundary pass; the sdk vitest suite is for the owner to run under the lock.
