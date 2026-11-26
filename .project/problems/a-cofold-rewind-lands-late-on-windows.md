---
title: A cofold rewind through the host lands late on Windows
status: open
date: 2026-11-26
severity: minor
refs:
  - "[code://packages/agent-cofold/test/agent-cofold-fork.test.ts#L450-L463](../../packages/agent-cofold/test/agent-cofold-fork.test.ts#L450-L463) - the case, which waits for the store to hold four messages after `chat/truncated`"
  - git://ee44b6c81 - main when the case failed
---

## Symptom

On 2026-11-26, CI's `windows (3/4)` on main, run 45767272711 for the merge of #486, failed `rewinds through the host, under the id the session already had` with `still waiting after 15000 ms`.
The wait at line 462 reads the store's messages until there are four, after the case dispatched `chat/truncated` at `t2`.
The log shows no `EPERM` or `EBUSY`.
#486 does not change `packages/agent-cofold`.
It is the only sighting in the failed CI jobs from 2026-11-16 to 2026-11-26.

## Cause

Unknown. The truncation did not land in the store within 15 s, or the read did not see it.
The case does not say which.

## Impact

A Windows CI job can fail for no fault in the cofold agent.

## Workaround

None. A rerun is not a fix.
