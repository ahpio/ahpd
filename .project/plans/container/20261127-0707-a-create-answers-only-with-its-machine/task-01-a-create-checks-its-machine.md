---
title: A create checks its machine
status: done
depends: []
layer: "computer"
---

## Objective

`create` answers only when `runtime.inspect` finds the machine it made. When it does not, the create fails with what Docker says of the container.

## Files

- `UPDATE: packages/computer/src/provider.ts:340-347` - inspect the machine after `runtime.run`, and fail when it is not there.
- `UPDATE: packages/computer/src/runtime.ts` - a way to read a gone container's state, exit code and last log lines, where Docker still has them.
- `UPDATE: packages/computer/test/computer.test.ts` - the cases.

## Steps

1. After `runtime.run` in `create`, call `runtime.inspect(name)`.
2. When it is `undefined`, read the container's state, exit code and last 20 log lines where Docker still has them.
3. Fail with `-32603`: `<name> was made and is gone: <what Docker said>`.
4. Fail with `<name> was made and is gone, and Docker has nothing on it` when Docker has nothing.
5. Write a case where the scripted `docker run -d` answers and the container is not there afterwards.

## Validation

- The new case fails the create with the sentence, and the old create cases pass.
- The computer suite passes.
- `pnpm typecheck` passes.

## Resume

Built on 2026-11-27. A gone machine is read from `eventsOf`, the runtime's own log of events. A container that is gone has no state or log to read. The machine is read back by the id its run answered, which a router spells with its runtime.
