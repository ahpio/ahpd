---
title: The git watch reads once when armed
status: dropped
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/sessions/changes.ts#L1982-L2108](../../../../packages/sdk/src/sessions/changes.ts#L1982-L2108) - the watch and its `ready`"
---

## Objective

A change made between a changeset's first read and its watch being armed is read once the watch is armed.

## Files

- `UPDATE: packages/sdk/src/sessions/changes.ts:1982-2108` - `ready` fires the change once, after the directories are watched.
- `UPDATE: packages/sdk/test/changes-refresh.test.ts` - a change made before the watch is armed.

## Steps

1. At the end of `ready`, after `watchRef`, call `fire` once if the watch is still open.
2. Keep the 150 ms debounce, so an event in the same window gives one read.
3. Add a case: hold the watch's `rev-parse` back, run `git add`, then let the watch arm.

## Validation

- `changes-refresh.test.ts`: the host reads a change made before the watch arms, once it arms.
- `changes-refresh.test.ts`: the existing case passes unchanged.
- Run the sdk suite as HANDOFF *Tests* says.

## Resume

Dropped on 2026-11-17, before anything merged.
The host already reads a directory again once its watch says it is armed, in `facts.ts:694-701`, and two cases test it.
The race this task named does not exist, so the answer that chose it rested on a wrong reading.
Softov chose to treat the case as the branches case.
