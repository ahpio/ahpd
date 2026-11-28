---
title: A record keeps its attachments
status: todo
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/localturns.ts#L561-L570](../../../../packages/sdk/src/host/localturns.ts#L561-L570) - `begunWithOrigins`, the pattern"
---

## Objective

A turn's record keeps the attachments of the message it began with. A turn read back after a restart gets them back on its message, for every backend.

## Files

- `UPDATE: packages/sdk/src/host/localturns.ts:175-194` - `Recorded` and `recordedOf` read an optional `attachments` list.
- `UPDATE: packages/sdk/src/host/localturns.ts:379-389` - `turnRecordedAs` takes the attachments and keeps them in memory beside the origins.
- `UPDATE: packages/sdk/src/host/localturns.ts:561-570` - the read-back puts a record's attachments back on its turn's message.
- `UPDATE: packages/sdk/src/host/spawn.ts:1676-1681` - the turn the chat began is recorded with its message's attachments.
- `UPDATE: packages/sdk/src/host/spawn.ts:2034-2038` - the record under the backend's id keeps them too.
- `UPDATE: packages/sdk/test/host-chats.test.ts` - the cases.

## Steps

1. Add `attachments?: MessageAttachment[]` to `Recorded`, and read it in `recordedOf` where it is a list.
2. Give `turnRecordedAs` the attachments, and keep them by turn id as `originsAs` keeps origins.
3. At `chat/turnStarted`, record the message's attachments as the host rewrote them.
4. In `onTurnRecorded`, record the same attachments under the transcript id.
5. Put a record's attachments on the read-back turn's message, before `asBegun`, as origins are.
6. Send the read-back attachments through `asSentAttachment`, as a live turn's are.
7. Write a case that sends a picture, restarts the host, and reads the chat back with the picture.
8. Write a case where a record has no `attachments`, and the turn reads back as now.

## Validation

- The new cases in `host-chats.test.ts` pass.
- The sdk suite passes.
- `pnpm typecheck` passes.

## Resume
