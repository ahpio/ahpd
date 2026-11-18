---
title: A start the service refused is tried again
status: todo
depends: []
layer: "tunnel-devtunnel"
refs:
  - "[code://packages/tunnel-devtunnel/src/kind.ts#L522-L539](../../../../packages/tunnel-devtunnel/src/kind.ts#L522-L539) - the error path of `start`"
  - "[code://packages/tunnel-devtunnel/src/adapter.ts#L146-L175](../../../../packages/tunnel-devtunnel/src/adapter.ts#L146-L175) - `OpenTunnels`"
---

## Objective

A record whose start failed with 401 starts again after a delay, and again when its connector holds a new token, until it runs or a person stops it.

## Files

- `UPDATE: packages/tunnel-devtunnel/src/adapter.ts:146-175` - `OpenTunnels` gains `onHold`, a listener told each time a token is held.
- `UPDATE: packages/tunnel-devtunnel/src/kind.ts:451-540` - a 401 schedules a retry, and a held token starts the records that wait.
- `UPDATE: packages/tunnel-devtunnel/test/tunnel-devtunnel-kind.test.ts` - the cases of a retry.
- `UPDATE: packages/tunnel-devtunnel/README.md:148` - a start refused with 401 is tried again.
- `UPDATE: docs/updates/v0_15.md` - a line in the unreleased notes.

## Steps

1. Add `onHold(listener)` to `OpenTunnels`, called with the connector id each time `hold` runs, and answer a function that removes it.
2. In `start`, on an error whose status is 401, schedule `start` for the record again after the delay in force.
3. Start the delay at 30 s, double it after each refused try, and stop at 10 min.
4. Keep each waiting record by its connector, and start it again when `onHold` names that connector.
5. Clear a record's timer and drop it from the waiting set when it runs, stops, is disabled or is removed.
6. Clear every timer and the listener when the plugin stops.
7. Report the row's error with the time of the next try.
8. Add a case: a service that answers 401 once, then serves, sees the record running after the first retry.
9. Add a case: a waiting record starts when its connector holds a new token.
10. Add a case: a stopped record is not tried again.
11. Say in *What the system tunnel does at startup* that a start refused with 401 is tried again.
12. Add a line to the unreleased notes.

## Validation

- The cases of steps 8 to 10 pass, and the first fails without step 2.
- The tunnel-devtunnel suite and the server suite pass, one at a time, as HANDOFF *Tests* says.

## Resume

