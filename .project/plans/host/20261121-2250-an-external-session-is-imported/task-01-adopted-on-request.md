---
title: An external session is adopted on request
status: todo
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
