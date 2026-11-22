---
title: A session is created from a conversation - implemented
date: 2026-11-21
refs:
  - git://7b768a694
  - "[code://packages/sdk/src/host/sessionimport.ts](../../../../packages/sdk/src/host/sessionimport.ts)"
  - "[code://packages/sdk/src/host/sessionmethods.ts](../../../../packages/sdk/src/host/sessionmethods.ts)"
  - "[code://packages/sdk/src/host/vscodemethods.ts](../../../../packages/sdk/src/host/vscodemethods.ts)"
  - "[code://packages/sdk/src/host/handshake.ts](../../../../packages/sdk/src/host/handshake.ts)"
  - "[code://packages/sdk/src/host/gate.ts](../../../../packages/sdk/src/host/gate.ts)"
  - "[code://packages/sdk/src/types/agent.ts](../../../../packages/sdk/src/types/agent.ts)"
  - "[code://packages/agent-claude/src/transcript.ts](../../../../packages/agent-claude/src/transcript.ts)"
  - "[code://packages/agent-claude/src/claude.ts](../../../../packages/agent-claude/src/claude.ts)"
  - "[code://packages/agent-pi/src/transcript.ts](../../../../packages/agent-pi/src/transcript.ts)"
  - "[code://packages/agent-pi/src/agent.ts](../../../../packages/agent-pi/src/agent.ts)"
  - "[code://packages/agent-cofold/src/transcript.ts](../../../../packages/agent-cofold/src/transcript.ts)"
  - "[code://packages/agent-cofold/src/agent.ts](../../../../packages/agent-cofold/src/agent.ts)"
  - "[code://packages/sdk/test/session-import-chunks.test.ts](../../../../packages/sdk/test/session-import-chunks.test.ts)"
  - "[code://packages/agent-claude/test/import-conversation.test.ts](../../../../packages/agent-claude/test/import-conversation.test.ts)"
  - "[code://packages/agent-pi/test/import-conversation.test.ts](../../../../packages/agent-pi/test/import-conversation.test.ts)"
  - "[code://packages/agent-cofold/test/import-conversation.test.ts](../../../../packages/agent-cofold/test/import-conversation.test.ts)"
---

A client can now create a session from a conversation it already has. The client stages the conversation in chunks on `vscode/stageCreateSessionImportChunk`, or sends it inline, and `createSession` with `_meta['vscode.importConversation']` hands the turns to an agent that can write them. Claude, pi and cofold write the turns as their own history before the session starts, so the new session resumes, forks and truncates like one they ran themselves. A host advertises `vscode.createSessionImport` while one of its agents can import, and refuses an import for an agent that cannot.

## What was built

- [`code://packages/sdk/src/host/sessionimport.ts`](../../../../packages/sdk/src/host/sessionimport.ts) - the staged transfers and their character total on a connection, `stageImportChunk` with the 1,048,576-unit chunk limit and the 268,435,456-unit connection limit, `takeImport`, `dropImports`, `freshTurnIds`, and `readCreateSessionImportValue` and `readCreateSessionImportMeta`, which read `{transferId}` or an inline `{turns, model?, title?}` and refuse a model with a blank id.
- [`code://packages/sdk/src/host/vscodemethods.ts`](../../../../packages/sdk/src/host/vscodemethods.ts) - `vscode/stageCreateSessionImportChunk`, which holds one chunk under its transfer id and refuses a blank id, an empty chunk, an over-long chunk, and a chunk that would pass the connection's staged total.
- [`code://packages/sdk/src/host/sessionmethods.ts`](../../../../packages/sdk/src/host/sessionmethods.ts) - `createSession` takes the staged transfer before anything is claimed, refuses an import beside a fork and an agent without `importConversation`, mints a fresh id per turn, cuts a worktree before the backend starts rather than at the first turn, calls the agent's `importConversation` with the folder, settings, turns, model and nonblank title, then starts the session with the title and without owing a worktree.
- [`code://packages/sdk/src/types/agent.ts`](../../../../packages/sdk/src/types/agent.ts) and [`types/index.ts`](../../../../packages/sdk/src/types/index.ts) - `ImportedConversation`, and the optional `Agent.importConversation`.
- [`code://packages/sdk/src/host/handshake.ts`](../../../../packages/sdk/src/host/handshake.ts), [`gate.ts`](../../../../packages/sdk/src/host/gate.ts), [`context.ts`](../../../../packages/sdk/src/host/context.ts) and [`host.ts`](../../../../packages/sdk/src/host/host.ts) - `vscode.createSessionImport` while one agent can import, `session:create` for the staging method, and the per-connection `imports` state.
- [`code://packages/agent-claude/src/transcript.ts`](../../../../packages/agent-claude/src/transcript.ts) and [`catalog.ts`](../../../../packages/agent-claude/src/catalog.ts) - `framesFor` writes a user frame per turn, an assistant frame per response part, a `tool_use` and `tool_result` pair per completed call, and a system notification frame; `writeImportedHistory` writes the frames as `<config>/projects/<projectOf(folder)>/<sessionId>.jsonl`. `claude.ts` adds `importConversation`.
- [`code://packages/agent-pi/src/transcript.ts`](../../../../packages/agent-pi/src/transcript.ts) and [`agent.ts`](../../../../packages/agent-pi/src/agent.ts) - `framesFor` writes a kept `ahpd.message` entry, the user entry whose id is the turn id, a run of assistant blocks per reply (with a `toolResult` after each completed call), and the turn's usage, model and stop reason on its last assistant entry; `writeImportedHistory` opens pi's own `SessionManager` under the session id and writes the header and entries. `agent.ts` adds `importConversation`, remembers the id it wrote by session URI, and has `create` resume it for the top-level chat.
- [`code://packages/agent-cofold/src/transcript.ts`](../../../../packages/agent-cofold/src/transcript.ts) and [`agent.ts`](../../../../packages/agent-cofold/src/agent.ts) - `writeImportedHistory` makes the store session, appends the person's message, one assistant message of the turn's parts and one tool message of its results, then writes the run with the turn's usage, status and span on the turn's own `createdAt` and `updatedAt`, and a failed `run.finished` event where the turn failed. `agent.ts` adds `importConversation` under the URI's session id.
- [`code://packages/sdk/test/session-import-chunks.test.ts`](../../../../packages/sdk/test/session-import-chunks.test.ts) - three staged chunks taken by `createSession`, an inline conversation and a blank title, each chunk limit, the staged total, an unknown transfer and a malformed value, a closed connection, an agent that cannot import, an import beside a fork, the worktree cut before the start, and a user who may and may not stage.
- [`code://packages/agent-claude/test/import-conversation.test.ts`](../../../../packages/agent-claude/test/import-conversation.test.ts), [`agent-pi/test/import-conversation.test.ts`](../../../../packages/agent-pi/test/import-conversation.test.ts) and [`agent-cofold/test/import-conversation.test.ts`](../../../../packages/agent-cofold/test/import-conversation.test.ts) - each writer's frames or rows, a read back equal to the import, and a resume of a session started after it.

## Verified

- `pnpm typecheck` passes.
- `pnpm boundary` passes: 13 packages, every dependency declared and none undeclared.
- The sdk, agent-claude, agent-pi and agent-cofold suites have not been run. The owner runs every suite under the lock, and the four new test files were not added to git by the commits because `git add` was not available: `packages/sdk/src/host/sessionimport.ts`, `packages/sdk/test/session-import-chunks.test.ts`, `packages/agent-claude/test/import-conversation.test.ts`, `packages/agent-pi/test/import-conversation.test.ts` and `packages/agent-cofold/test/import-conversation.test.ts`.
- No live daemon, CLI process or VS Code window was driven.

## Departures from the plan

- **The Claude and pi resumes are checked at the seam, not against a live backend.** The plan's risk note says the Claude writer is tested by resuming the written session with the CLI ahpd pins. The test mocks the agent SDK and asserts that the start hands it `{resume: id}` and no new session id; pi's does the same through the fake pi. Only cofold resumes against its real file store, with a fake model.
- **A refused `createSession` still takes the transfer.** The staged conversation is taken before admission and the other checks, so a create refused later loses its chunks rather than keeping them for another try. The plan says the transfer is taken once and does not say what a refusal does with it.
- **A failed import leaves what it wrote.** An `importConversation` that throws before the session starts leaves the Claude or pi file, or the cofold rows written so far, and the host makes no session. Nothing removes the partial history.
- **Pi remembers the session id in the agent.** `piAgent` cannot be handed a session id by `create`, so each agent keeps the id it wrote by session URI and resumes it only for the top-level chat (`start.chatId` undefined). A peer chat of the same session starts a new pi conversation.
- **Cofold refuses to overwrite.** `writeImportedHistory` creates the store session, so importing into an existing session id fails with `already_exists`; the Claude and pi writers overwrite the file at their session's path. The store session also takes the import time as its creation, not the conversation's first turn.
- **Claude loses the part kinds it has no frame for.** A `contentRef` is written as the URI, an `inputRequest` as its message, and an `error` part as `errorType: message`, so all three read back as markdown. A system notification keeps its own frame and reads back as one. The user message's attachments, origin and model are not written, and the message reads back as the person's. A part is its own assistant frame, so a reply that was one part stays one part but adjacent parts stay separate.
- **Pi loses the part kinds it has no block for.** A `systemNotification`, a `contentRef` and an `inputRequest` are written as text and read back as markdown. An `error` part becomes the last assistant entry's `errorMessage` and `stopReason`, so it reads back as an error part with `errorType: 'error'` and the original message, and only the last failed turn's part reads back resumable. A call that never completed has no result entry, reads back cancelled as skipped, and can turn a complete turn into a cancelled one. Attachments, origin and the message's model are not written, and the origin reads back as the person's.
- **Pi's model id gains a provider when it had none.** A turn model without a `/` is written as `imported/<id>`, because pi's replay reads a model as `provider/model`; the turn reads back with that provider.
- **Pi's tool `_meta` gains fields.** Every result is written at the turn's start, so a call reads back with `vscode.toolCallDurationMs: 0`, and shell calls gain pi's own tool kind. The imported call's timing is not kept.
- **Cofold loses the part kinds it has no part for.** A `systemNotification`, a `contentRef` and an `inputRequest` are written as text. An `error` part is not a part but the run's failed outcome, read back with only the last error part's `code` and `message`, so the kind and `resumable` are lost. A turn's results are one tool message after the answer, each result flattened to one string, so the result content is not read back as the blocks it held.
- **Cofold invents what its format requires.** Usage needs input and output tokens, so a turn with no usage reads back as zeros; every turn has a duration, 0 when the import had none; every person's message has source `input`, so a notice or a summary reads back as the person's; and a call's title and past tense are derived from the tool name, so the imported `invocationMessage` and `pastTenseMessage` are not kept.
- **Every writer takes the turn's timestamps but not its inner ids.** The host mints each turn's id, as the plan says. `startedAt` is the turn's where it is a date and the end of the previous turn otherwise, and the ids of assistant messages, entries and frames are the writer's own. A tool input that is a string is written as the object it parses to, as `{command}` for a shell tool and as `{pattern}` for grep, glob and find, so `toolInput` can read back as JSON the import did not have.
- **The capability is host-wide.** `vscode.createSessionImport` is advertised when any agent of the host can import, as the plan's default says, and `createSession` refuses an import for an agent that cannot, rather than the advertisement following the chosen provider.

## Left for later

- The four suites, one at a time, and the plan's final verification checklist, which is signed off when they pass.
- No `deferred.md`: both pi and cofold can load a history they did not write, so neither stops at task 03.
- A live daemon or VS Code window was not driven, so what a window makes of an imported session was not checked end to end.
