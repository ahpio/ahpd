---
title: A closed host's scratch folder is still busy on Windows
status: open
date: 2026-11-27
severity: minor
refs:
  - "[code://packages/sdk/test/host-chats.test.ts#L1946-L1972](../../packages/sdk/test/host-chats.test.ts#L1946-L1972) - the case, which closes its host and then clears the folder"
  - "[code://tools/holders.ts#L47-L60](../../tools/holders.ts#L47-L60) - `holders`, which reads `/proc` and the fake CLIs' marks"
  - git://13176767c - main under the PR when the case failed
---

## Symptom

On 2026-11-27, CI's `windows` job on #496, run 45942728944, failed `refuses a move of a chat working in its session's scratch folder, which the default chat shares` in `host-chats.test.ts`.
The error is `EBUSY: resource busy or locked, rmdir '...\.copilot\chats\live'` from `clearFolder` in the case's `finally`.
The case awaits `host.close()` before `clearFolder`.
The folder's files were written 118 ms to 240 ms before the error, and the message says `Holders: none`.
#496 does not change the host's chats or the scratch folder.

## Cause

Unknown. Something still had the scratch folder open after the host closed.
On Windows, `holders` finds only the processes that left a mark under `ahpd-test-holders`, because there is no `/proc`.
So `Holders: none` does not mean that no process held the folder.
A process whose working directory is the scratch folder, or a watch in the test's own process, would hold it.

## Impact

A Windows CI job can fail for no fault in the change under test, and block its merge.

## Workaround

None. A rerun is not a fix.
