---
title: A sent attachment comes back
domain: host
status: planned
priority: high
created: 2026-11-28
revalidated: 2026-11-28
refs:
  - git://7f6fe14c8 - main when the plan was made, and the last commit that holds the problem file `a-sent-attachment-is-gone-from-its-message-after-a-restart.md`
  - "[code://packages/sdk/src/host/localturns.ts#L175-L194](../../../../packages/sdk/src/host/localturns.ts#L175-L194) - `Recorded`, a turn's record: its transcript id, its turn id and its origin"
  - "[code://packages/sdk/src/host/localturns.ts#L379-L389](../../../../packages/sdk/src/host/localturns.ts#L379-L389) - `turnRecordedAs`, which writes the record"
  - "[code://packages/sdk/src/host/localturns.ts#L561-L570](../../../../packages/sdk/src/host/localturns.ts#L561-L570) - `begunWithOrigins`, the pattern to copy for attachments"
  - "[code://packages/sdk/src/host/spawn.ts#L1676-L1681](../../../../packages/sdk/src/host/spawn.ts#L1676-L1681) - where a turn the chat began is recorded"
  - "[code://packages/sdk/src/host/spawn.ts#L2034-L2038](../../../../packages/sdk/src/host/spawn.ts#L2034-L2038) - where a turn is recorded again under the id the backend wrote it by"
  - "[code://packages/sdk/src/host/attachments.ts#L219-L241](../../../../packages/sdk/src/host/attachments.ts#L219-L241) - `tagged`, the attachment as the host rewrote it, naming its file"
  - "[code://packages/agent-claude/src/session/attachments.ts#L40](../../../../packages/agent-claude/src/session/attachments.ts#L40) - a picture goes to the CLI as a base64 image block"
  - "[code://packages/agent-claude/src/transcript.ts#L804-L811](../../../../packages/agent-claude/src/transcript.ts#L804-L811) - a user turn read back as its text and origin only"
---

## Goal

A message keeps its attachments after a restart, in every client. On 2026-11-23, Softov's photos and screenshots were gone from their messages in ahpapp after a restart, and their files were still on disk.

## Reconnaissance

- The cause, read from the code, is in the problem file at the `git://` ref.
- The host writes each attachment to a file in a folder with a random id, under the session's attachments folder.
- The host sends the message on with a `resource` that names the file.
- A turn's record keeps its transcript id, its turn id and its origin. `begunWithOrigins` puts the origin back on a read-back turn.
- A picture reaches the Claude CLI as a base64 image block, so the transcript holds its bytes and not the host's file.
- The session's attachments folder also holds the host's `turns` and `recorded` folders.
- VS Code's Claude replay reads back no attachments. Its Codex replay finds them by their path in the transcript.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A turn's record keeps its message's attachments as the host rewrote them, and the read-back turn gets them back | Softov, 2026-11-28, chose "Record them" | 01 |
| A turn recorded before the fix gets its attachments back by content: a block's bytes in the transcript find the file with the same bytes | Softov, 2026-11-28, chose "Match by content" | 02 |
| The record stays at version 1, with an optional `attachments` field | (defaulted: a record without it reads as now) | 01 |
| A record's attachments win over a match by content | (defaulted: the record is exact) | 02 |
| The Claude backend hands the host a hash of each block's bytes, never the bytes | (defaulted: a read-back stays light) | 02 |
| The host hashes the files of a session's attachments folder once for each daemon run, and keeps the hashes in memory | (defaulted: one read per session, nothing new on disk) | 02 |
| A block with no file of its bytes comes back with no attachment | (defaulted: no file means nothing a client can open) | 02 |
| The `turns` and `recorded` folders are never matched | (defaulted: they hold the host's own records) | 02 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - a-record-keeps-its-attachments](task-01-a-record-keeps-its-attachments.md) | todo | - |
| [02 - an-old-turn-finds-its-files-by-content](task-02-an-old-turn-finds-its-files-by-content.md) | todo | 01 |

## Risks and tradeoffs

- A session with many attachments reads every file once at its first read-back after a restart. Softov's session `229a97fe` holds 126.
- A match by content covers only what the transcript holds as bytes: pictures and documents sent as blocks.
- Two files with the same bytes match the same block, and either one is the right picture.

## Resume state

- **Done so far:** nothing.
- **Next action:** task 01.
- **Open questions:** none.
- **Watch out for:** `asSentAttachment` turns the host's file back into what the client sent, on the way out. A read-back attachment must take the same path.

## Final verification checklist

- [ ] A message sent after the fix shows its attachments after a restart.
- [ ] A Claude message sent before the fix shows its pictures after a restart.
- [ ] The sdk and agent-claude suites pass, and `check-windows` passes.
