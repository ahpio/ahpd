---
title: A client row says when it last moved - implemented
date: 2026-11-14
refs:
  - git://8f5ae19d0 - the last code commit of the build
  - "[code://packages/sdk/src/clients/channel.ts](../../../../packages/sdk/src/clients/channel.ts) - `countFrame` and the two times"
  - "[code://packages/sdk/src/listen.ts](../../../../packages/sdk/src/listen.ts) - the two headers on each runtime"
---

A client row says when a frame last crossed each way, when the client last pinged, and whether it came in fresh or resumed.
It also says how many of its requests the host refused, and the `User-Agent` and `Origin` its socket opened with.

## What was built

- [`code://packages/sdk/src/clients/channel.ts`](../../../../packages/sdk/src/clients/channel.ts) - `lastIn` and `lastOut` in `ClientCounts`, and `countFrame`, which the daemon's tap calls.
- [`code://packages/sdk/src/host/handshake.ts`](../../../../packages/sdk/src/host/handshake.ts) - `ping` sets `lastPing`; `initialize` and `reconnect` set `arrival`.
- [`code://packages/sdk/src/host.ts`](../../../../packages/sdk/src/host.ts) - `handle` counts a refusal; `accept` keeps the headers; `clientRow` copies the five fields.
- [`code://packages/sdk/src/listen.ts`](../../../../packages/sdk/src/listen.ts) - Node, Bun and Deno read `User-Agent` and `Origin` into `Opened`.
- [`code://docs/plugins/PLUGINS.md`](../../../../docs/plugins/PLUGINS.md) - the `x-ahpd-clients` section names the seven fields, and says which are claims.

## Verified

- `pnpm typecheck`, `pnpm boundary` and `pnpm build` pass.
- The server suite: 1880 pass. The sdk suite: 4826 pass. Two `host-permissions.test.ts` cases fail on this machine, and fail the same on a clean `origin/main`.
- New cases: `countFrame` and the times on a row in `clients-channel.test.ts`; `lastPing`, `arrival`, `refused` and the headers in `host-handshake.test.ts`; both headers, and neither, in `listen-identity.test.ts`.
- By hand: a Bun and a Deno listener each reported both headers.
- Softov validated the fields on 2026-11-14 through the ahpw client page.

## Departures from the plan

- none.

## Left for later

- nothing.
