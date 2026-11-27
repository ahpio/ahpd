---
title: A stdio host leaves out its listeners - implemented
---

## What exists now

- A host on `--stdio` leaves `httpApi`, `modelApi` and `routes` of its file out, and logs `<key> is left out: --stdio serves one connection on this process's own pipes, and no port.` for each.
- The two refusals of those keys under `--stdio` are gone. The credential check runs after the keys are left out, so it does not stop such a host.
- `COMPUTERS.md`, `CONFIGURE.md` and the 0.16 notes, under a new rc.2 heading, say so.

## Verified

- `stdio-listeners.test.ts`: a `--stdio` host with the three keys answers its handshake and logs three lines; one with none logs none.
- The server suite passes 2009 cases, and the computer suite passes 696.
- `pnpm typecheck` passes.

## Departures from the plan

- The `routes` case of `plugin-route.test.ts` is removed, not changed: its helper waits for a WebSocket line that a `--stdio` host never prints. The new file holds the case.
- `mcpTools` stops nothing when `httpApi` is left out: no check reads the two together.
