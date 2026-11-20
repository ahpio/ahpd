---
title: A cofold first-turn resume case runs out of ticks
status: open
date: 2026-11-20
severity: minor
blocks: []
refs:
  - "[code://packages/agent-cofold/test/agent-cofold-turn.test.ts#L54-L61](../../packages/agent-cofold/test/agent-cofold-turn.test.ts#L54-L61) - `until`, which waits 400 zero-delay ticks and no wall-clock time"
  - "[code://packages/agent-cofold/test/agent-cofold-turn.test.ts#L1383-L1430](../../packages/agent-cofold/test/agent-cofold-turn.test.ts#L1383-L1430) - the case that failed"
  - "[code://packages/agent-cofold/test/agent-cofold-fork.test.ts#L41](../../packages/agent-cofold/test/agent-cofold-fork.test.ts#L41) - a wait in the same package with a wall-clock deadline"
  - https://github.com/ahpio/ahpd/actions/runs/44786022773/job/136460983985 - the CI job of #394 where it failed
  - git://74ec926ce - main when the problem was read
---

## Symptom

CI run 44786022773 of #394 failed `linux (2/2)` on 2026-11-20.
`agent-cofold-turn.test.ts`: `resumes a conversation's first turn by dropping the session and starting it again` threw `still waiting after 400 tries` after 453 ms.
The other 4154 tests of the shard passed.
Dry run 44712120112 passed the same case on the same tree, and #394 does not change `packages/agent-cofold`.

## Cause

`until` gives the run 400 `setTimeout(0)` ticks, near 0.4 s, whatever the machine does.
The resume of a first turn drops the session record and makes it again in a file store on disk.
On a busy runner that file work can take longer than 400 ticks.

## Impact

`check` on a PR or on main goes red at random.
It blocks a merge until the case is fixed, because a rerun is not a fix.

## Workaround

None.

## Fix

- Give `until` a wall-clock deadline, as `agent-cofold-fork.test.ts` does, and keep the tick loop inside it.
- Or raise the tick count for the cases that touch the file store only.
