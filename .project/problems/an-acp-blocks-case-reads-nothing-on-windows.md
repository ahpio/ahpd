---
title: An ACP blocks case reads no answer on Windows at random
status: open
date: 2026-11-26
severity: minor
refs:
  - "[code://packages/agent-acp/test/agent-acp-blocks.test.ts#L266-L287](../../packages/agent-acp/test/agent-acp-blocks.test.ts#L266-L287) - the case"
  - git://a7c96444c - main when the problem was read
---

## Symptom

On 2026-11-26, CI's `windows (1/4)` on #489, run 45771823399, failed `agent-acp-blocks.test.ts`: `names a file the client gave by URI, and does not read it`.
`said` was `''`, where the case expects the blocks the fixture agent echoes.
The same case passed on Windows in the runs of #485 to #488, and #489 does not change `packages/agent-acp`.

## Cause

Unknown.
The fixture agent answers nothing, so the prompt may end before the agent writes its echo, or the agent may fail to start.

## Impact

A Windows CI job can fail for no fault in the change under test.

## Workaround

None. A rerun is not a fix.

## Fix

- Make the case wait for the agent's echo, not for the end of the prompt.
- Make the fixture say why it answered nothing, so the next failure names its cause.
