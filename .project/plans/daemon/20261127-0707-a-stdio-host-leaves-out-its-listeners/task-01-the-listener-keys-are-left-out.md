---
title: The listener keys are left out
status: done
depends: []
layer: "server"
---

## Objective

A host started with `--stdio` starts when its file sets `httpApi`, `modelApi` or `routes`. It leaves each one out and logs one line that names it.

## Files

- `UPDATE: packages/server/src/commands/run.ts:481-500` - leave the three keys out under `--stdio`, with a log line each, before the credential check.
- `UPDATE: packages/server/test/plugin-route.test.ts:294-297` - the `routes` case expects a start and the line.
- `CREATE: packages/server/test/stdio-listeners.test.ts` - a `--stdio` host with `httpApi` and `modelApi` in its file starts, and logs a line for each.
- `UPDATE: docs/plugins/COMPUTERS.md:404` - the box host leaves out the box's own listeners.
- `UPDATE: docs/server/CONFIGURE.md:137` - `--stdio` leaves out `httpApi`, `modelApi` and `routes`.

## Steps

1. Under `--stdio`, take `httpApi`, `modelApi` and `routes` out of the options before the checks in `run.ts`.
2. Log `<key> is left out: --stdio serves one connection on this process's own pipes, and no port.` for each key taken out.
3. Remove the two `--stdio` refusals.
4. Change the `routes` case to expect a host that starts and logs the line.
5. Write the case of `httpApi` and `modelApi` beside it.
6. Write in the box docs and in `CONFIGURE.md` that `--stdio` leaves the three keys out.

## Validation

- `stdio-listeners.test.ts` and `plugin-route.test.ts` pass.
- The server suite passes.
- `pnpm typecheck` passes.

## Resume

Built on 2026-11-27. The `routes` case of `plugin-route.test.ts` is removed, and `stdio-listeners.test.ts` holds it beside the other two keys.
