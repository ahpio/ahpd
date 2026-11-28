---
title: A sent attachment comes back - implemented
date: 2026-11-28
refs:
  - "[code://packages/sdk/src/host/localturns.ts](../../../../packages/sdk/src/host/localturns.ts)"
  - "[code://packages/agent-claude/src/transcript.ts](../../../../packages/agent-claude/src/transcript.ts)"
---

A message keeps its attachments after a restart, for every backend. A Claude message sent before this change gets its pictures back from the session's attachments folder, found by their bytes.

## What was built

- [`code://packages/sdk/src/host/localturns.ts`](../../../../packages/sdk/src/host/localturns.ts) - a turn's record keeps `Said`: the origin and the attachments as the host rewrote them. `begunAsRecorded` puts both back on a read-back turn. `begunWithBytes` matches the hashes a backend names to the session's files, and removes the key.
- [`code://packages/sdk/src/host/spawn.ts`](../../../../packages/sdk/src/host/spawn.ts) - the turn's start and the record under the backend's id keep the message's attachments.
- [`code://packages/sdk/src/resources/attachments.ts`](../../../../packages/sdk/src/resources/attachments.ts) - `SENT_BYTES_KEY` and `sentBytesOf`, which the host and a backend hash with.
- [`code://packages/sdk/src/host/attachments.ts`](../../../../packages/sdk/src/host/attachments.ts) - `heldAttachment`, a matched file as the attachment a live message has.
- [`code://packages/agent-claude/src/transcript.ts`](../../../../packages/agent-claude/src/transcript.ts) - a user turn read back names the hash and type of each picture it was sent with.

## Verified

- `host-local-turns.test.ts`: a picture comes back after a restart as the file the host wrote, and a message with none records none.
- `host-local-turns.test.ts`: a turn with no recorded attachments gets the file with its bytes.
- `host-local-turns.test.ts`: bytes no file holds, or only a file in the host's own folders, give nothing, and a record's attachments win over a match.
- `agent-claude-transcript.test.ts`: a prompt with a picture names its hash and type, and one with none names nothing.
- The three files pass 79 cases. The agent-claude suite passes 740 cases, the sdk suite 5436, and `pnpm typecheck` passes.

## Departures from the plan

- The cases are in `host-local-turns.test.ts`, beside the origin cases, not in `host-chats.test.ts`.
- `turnOriginOf` became `turnSaidOf`, which answers the origin and the attachments together.
- Only pictures are matched: a document reaches the CLI as text, so the transcript holds no bytes of it.
- The host reads only the folders that `put` names with a UUID, not every folder but `turns` and `recorded`: the session's folder also holds `terminals`.
- An attachment still embedded, which the host could not write to a file, stays out of the record.

## Left for later

- A session sent before the fix, opened on Softov's own daemon, is a check by hand: [pending/attachments-come-back-checks.md](../../../pending/attachments-come-back-checks.md).
