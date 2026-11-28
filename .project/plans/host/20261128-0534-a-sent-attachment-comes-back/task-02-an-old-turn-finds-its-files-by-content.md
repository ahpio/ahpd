---
title: An old turn finds its files by content
status: done
depends: [task-01-a-record-keeps-its-attachments.md]
layer: "sdk, agent-claude"
refs:
  - "[code://packages/agent-claude/src/transcript.ts#L804-L811](../../../../packages/agent-claude/src/transcript.ts#L804-L811) - the user turn read back"
  - "[code://packages/agent-claude/src/session/attachments.ts#L40](../../../../packages/agent-claude/src/session/attachments.ts#L40) - the image block a picture goes as"
---

## Objective

A Claude turn whose record has no attachments gets back the files whose bytes its transcript holds. The host finds each file in the session's attachments folder by a hash of its bytes.

## Files

- `UPDATE: packages/agent-claude/src/transcript.ts:804-811` - a user turn read back carries a hash of each image block's bytes.
- `UPDATE: packages/sdk/src/host/localturns.ts` - the host matches each hash to a file in the session's attachments folder, and puts the attachment on the message.
- `UPDATE: packages/sdk/src/host/attachments.ts:219-241` - `heldAttachment` builds a matched file's attachment with `tagged`, as a live one is built.
- `UPDATE: packages/sdk/src/resources/attachments.ts` - `SENT_BYTES_KEY` and `sentBytesOf`, which both sides hash with.
- `UPDATE: packages/sdk/src/index.ts` - exports the key and the hash.
- `UPDATE: packages/agent-claude/test/agent-claude-transcript.test.ts` - the hashes on a read-back turn.
- `UPDATE: packages/sdk/test/host-local-turns.test.ts` - the match cases.

## Steps

1. In the Claude read-back, hash the decoded bytes of each image block of a user turn with SHA-256.
2. Put the hashes in the read-back message's `_meta`, under a key of the host's, in the order of the blocks.
3. At a session's first read-back in a daemon run, hash each file in a folder that `put` named.
4. Keep the hashes in memory by session, and hash only files added since the last read.
5. For a turn with no recorded attachments, put back the file of each hash with `tagged`.
6. Leave out a hash with no file, and remove the key from the message the client sees.
7. Write a case that sends a picture, removes the record's attachments, restarts, and reads the picture back.
8. Write a case where the record and a match both exist, and the record wins.

## Validation

- The new cases in `agent-claude-transcript.test.ts` and `host-local-turns.test.ts` pass.
- The sdk and agent-claude suites pass.
- `pnpm typecheck` passes.
- On a test daemon, a copy of a session sent before the fix shows its pictures.

## Resume

Built on 2026-11-28. Only pictures are matched, because a document reaches the CLI as text. The host reads only the folders `put` names with a UUID. The case writes the file under the session's folder, not through a first send.
