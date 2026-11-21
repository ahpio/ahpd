---
title: The relay case waits 4 s for a nested daemon started from source
status: open
date: 2026-11-21
severity: minor
blocks: []
refs:
  - "[code://packages/sdk/test/container-relay.test.ts#L121-L128](../../packages/sdk/test/container-relay.test.ts#L121-L128) - `until`, which waits `WAIT_MS`"
  - "[code://packages/sdk/test/container-relay.test.ts#L130-L150](../../packages/sdk/test/container-relay.test.ts#L130-L150) - the case, which waits for the nested host's first answer"
  - git://c5e471a71 - main when the problem was read
---

## Symptom

On 2026-11-21, a full sdk run on host/20261121-0555 failed `container-relay.test.ts`: `a session's host on the other side of the relay is a real one`.
It failed with `still waiting after 4000 ms` at the wait for the nested host's answer to `initialize`.
The file passed alone on the same branch, at a load average near 5.
The branch does not change the stdio path or the dev container relay.

## Cause

The case starts the nested daemon from `packages/server/src/main.ts` through the dev loader, so the first answer waits for the whole server to load from source.
On a busy machine that takes more than the 4 s of `WAIT_MS` that `until` waits.

## Impact

The sdk suite is red on a busy machine for no fault in the code.

## Workaround

None. A second run is not a fix.

## Fix

- Give the wait for the nested host's first answer a longer limit of its own.
- Or start the nested daemon from the built server.
