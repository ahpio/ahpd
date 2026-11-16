---
title: Changes and carets
status: done
depends: [task-01-the-document-channel.md]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/actions.ts#L33-L36](../../../../packages/sdk/src/host/actions.ts#L33-L36) - `dispatchable`"
  - "[code://packages/sdk/src/host/actions.ts#L239-L257](../../../../packages/sdk/src/host/actions.ts#L239-L257) - a client action routed to a store the host holds"
  - "[code://packages/sdk/src/host/gate.ts#L149](../../../../packages/sdk/src/host/gate.ts#L149) - `ACTION_NEEDS`"
---

## Objective

A client dispatches `changed` and `selected` on a document.
The host puts every change in order, and moves a change made on an older version past the ones taken since.
It sends each change and each caret to every subscriber.

## Files

- `CREATE: packages/sdk/src/host/textchanges.ts` - apply a change to a string, map a position through a change, map a change through a change.
- `UPDATE: packages/sdk/src/host/documents.ts` - `changed` and `selected`, the version, the log and the rebase.
- `UPDATE: packages/sdk/src/host/actions.ts` - the two actions are dispatchable and are routed to `documents.ts`.
- `UPDATE: packages/sdk/src/host/gate.ts` - `ACTION_NEEDS`: `selected` needs `file:get`, `changed` needs `file:put`.
- `CREATE: test/textchanges.test.ts` - the pure functions.
- `UPDATE: test/host-documents.test.ts` - changes and carets through the scenario client.

## Steps

1. Write `applyChanges(text, changes)` in `textchanges.ts`; every position is on the text before any entry applies.
2. Refuse a change whose entries are out of order, overlap, or fall outside the text.
3. Write `mapPosition(position, changes, assoc)`; `assoc` 1 puts a position at an insert after the insert, and -1 before it.
4. Write `mapChanges(changes, through)`; map each `from` with `assoc` 1 and each `to` with `assoc` -1.
5. In `mapChanges`, never let `to` fall before `from`.
6. Make `x-ahpd-shared/changed` and `x-ahpd-shared/selected` dispatchable, and route them to `documents.ts`.
7. Keep the last 500 changes taken, each with the version it applied to.
8. On `changed` at the current version, apply it, add one to the version, and emit it.
9. On `changed` at an older version in the log, map it through each change taken since.
10. Apply the mapped change, add one to the version, and emit it.
11. On `changed` at a version older than the log, emit it back to the sender with `rejectionReason` and change nothing.
12. Map the sender's `ranges` with its change, and store them on the person.
13. On `selected`, map `ranges` from its version to the current one, store them, and emit them with the current version.
14. Set `version` on each emitted action to the version its positions are in now.

## Validation

- `test/textchanges.test.ts`: apply a change, map at an insert with each `assoc`, map past a deletion, map a change through another.
- `test/host-documents.test.ts`: a change at the current version lands, and both clients get it with the sender's `origin`.
- The same file: two changes on one version both land, and both clients reach one text.
- The same file: two inserts at one place keep the order the host took them in.
- The same file: a change older than the log comes back with `rejectionReason`, and the text does not change.
- The same file: the host refuses `changed` without `file:put`, and `selected` without `file:get`.
- The same file: carets ride with a change and move with a later one.
- The same file: `selected` on an older version arrives on the current one.
- `pnpm test test/textchanges.test.ts test/host-documents.test.ts` passes.

## Resume

Built on 2026-11-15.
- `mapChange` keeps text the earlier change inserted inside a span the later one deletes, and splits the span around it. This is what CodeMirror's `ChangeSet.map` does, so a client on CodeMirror reaches the same text.
- A `selected` on a version older than the log is dropped, not refused: the next carets come soon.
- A refused change goes to every subscriber with `rejectionReason`, as every refused action does on this host.
