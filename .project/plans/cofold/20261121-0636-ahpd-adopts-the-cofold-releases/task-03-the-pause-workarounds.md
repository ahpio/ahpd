---
title: the pause workarounds
status: todo
depends: []
layer: "agent-cofold"
refs:
  - "[code://packages/agent-cofold/src/pauses.ts](../../../../../packages/agent-cofold/src/pauses.ts) - the pause bookkeeping, `createPauses`"
  - "[code://packages/agent-cofold/src/runs.ts#L186-L226](../../../../../packages/agent-cofold/src/runs.ts#L186-L226) - where `run.finished` and the paused state are recorded"
---

## Objective

ahpd no longer keeps a pause workaround that cofold now does itself, with the code it names found by its current name.

## Files

- `UPDATE: packages/agent-cofold/src/pauses.ts` - remove the workarounds cofold's pause plan replaces; the file is 232 lines today.
- `UPDATE: packages/agent-cofold/src/runs.ts` - remove the synthesized `run.finished` once cofold emits it.

## Steps

1. Read the cofold pause plan at `/github/cofold/.project/plans/agent/05-a-run-answers-its-own-pause/plan.md` and list each workaround it removes.
2. Find each listed workaround in `pauses.ts` and `runs.ts` under its current name.
3. Record in this task which names are stale and what replaces them.
4. Remove only the workarounds the cofold release makes unneeded.
5. Run `pnpm exec vitest run packages/agent-cofold`.

## Validation

- The agent-cofold tests pass.
- The task's note names each removed workaround.
