---
title: A Claude session's history starts at its last compaction after a restart
status: open
date: 2026-11-14
severity: major
refs:
  - "[code://packages/agent-claude/src/transcript.ts#L52-L71](../../packages/agent-claude/src/transcript.ts#L52-L71) - `turnsOf`: the turns read back with the SDK's `getSessionMessages`"
  - "[code://packages/agent-claude/src/transcript.ts#L104-L142](../../packages/agent-claude/src/transcript.ts#L104-L142) - `answeredIn` and `sessionFiles`, which already read the transcript file directly"
  - npm://@anthropic-ai/claude-agent-sdk@0.3.325 - `getSessionMessages` builds the conversation from the `parentUuid` links, and has no option to read across a compaction
  - https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/node/claude/claudeSavedChatReader.ts - VS Code's Claude agent reads a saved chat the same way
---

## Symptom

- Softov ran Claude session `ahp-session:/8cf0f145-69c7-47a4-9459-68152540ad85` from 15:29 UTC on 2026-11-14, and compacted it at 18:35 UTC.
- After a restart of the daemon, the session shows only the turns from the compaction on. `session history` serves 5 turns, and the first one has no prompt.
- The transcript file still holds every turn: 1314 lines from 15:29 UTC.
- `getSessionMessages('8cf0f145-…', { includeSystemMessages: true })` returns 22 messages, and the first is the `compact_boundary`. SDK 0.3.301 and 0.3.325 give the same answer.

## Cause

- A daemon that runs holds the turns in memory. After a restart, `turnsOf` reads them back from the CLI's transcript with `getSessionMessages`.
- A compaction writes a `compact_boundary` row with `parentUuid: null`. Only its `logicalParentUuid` names the turn before it.
- `getSessionMessages` follows `parentUuid` back from the last entry, so it stops at the last boundary.

## Impact

- After a restart, every client loses the history before the last compaction of each Claude session. The turns are still on disk, but no client can open them.
- A long session that compacts often keeps only a small part of what it did.
- VS Code's own Claude agent shows the same cut, so there is no reference behaviour to copy.

## Workaround

None in a client. The history is in `~/.claude/projects/<project>/<session id>.jsonl`.

## Fix

- Read across the boundary. Where the first message from `getSessionMessages` is a `compact_boundary`, ahpd reads the transcript file. It follows `logicalParentUuid`, then `parentUuid`, back to the first entry. It repeats this for each earlier compaction and puts those turns first. `answeredIn` already reads the same file.
- Keep ahpd's own copy of each session's turns, so a restart serves what the session held. This is a second store of the history, and much more work.
- Ask Anthropic for a `getSessionMessages` option that reads across a compaction.
