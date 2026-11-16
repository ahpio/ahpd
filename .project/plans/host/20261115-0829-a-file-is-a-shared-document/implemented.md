---
title: A file is a shared document - implemented
date: 2026-11-16
refs:
  - git://7bc308a23 - the merge of ahpio/ahpd#341
  - "[code://packages/sdk/src/host/shared.ts](../../../../packages/sdk/src/host/shared.ts) - the shared resources"
  - "[code://packages/sdk/src/host/textchanges.ts](../../../../packages/sdk/src/host/textchanges.ts) - changes and positions moved past other changes"
---

A file on the host is a shared resource on `x-ahpd-shared:<resource URI>`.
Several clients and an agent edit it live and see each other's carets.
The host keeps the file on disk in step.

## What was built

- [`code://packages/sdk/src/host/shared.ts`](../../../../packages/sdk/src/host/shared.ts) - each shared resource: its state, its people, its last 500 changes and its writes to disk. It rebases an older change.
- [`code://packages/sdk/src/host/textchanges.ts`](../../../../packages/sdk/src/host/textchanges.ts) - a change as a list of `{ from, to, insert }`, and how a change and a caret move past other changes.
- [`code://packages/sdk/src/host/channels.ts`](../../../../packages/sdk/src/host/channels.ts) - `SHARED_SCHEME`, the channel's name.
- [`code://packages/sdk/src/host/snapshots.ts`](../../../../packages/sdk/src/host/snapshots.ts) - the channel's snapshot, kept out of the replay buffer.
- [`code://packages/sdk/src/host/gate.ts`](../../../../packages/sdk/src/host/gate.ts) - `file:get` to open, and `file:put` to change or to edit.
- [`code://packages/sdk/src/host/actions.ts`](../../../../packages/sdk/src/host/actions.ts) - the client actions `changed`, `selected` and `editing`.
- [`code://docs/sdk/SHARED.md`](../../../../docs/sdk/SHARED.md) - the channel, its actions and its grants.

## Verified

- `packages/sdk/test/shared.test.ts`, `shared-gate.test.ts` and `textchanges.test.ts`.
- The suite at the PR: 9882 pass, and 3 that fail on main too: `host-permissions` (2) and `computer-devcontainer` (1).
- A test daemon with ahpio/ahpw#87, in two browsers.
- ahpio/ahpd#347 later made the shared document test wait for the host's write.

## Departures from the plan

- The plan named the channel `x-ahpd-document`. After Softov's test on 2026-11-15 it became a shared resource, `x-ahpd-shared`, with a `kind`. A person has a `kind` and `editing`, and the host's own connection is `root`. The plan's *Answers* hold each choice.

## Left for later

- A host tool for an agent's edits with its carets: the agent takes part through the file only, as the plan's *Answers* say.
