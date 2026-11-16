---
title: Comments on a resource, outside any session - implemented
date: 2026-11-16
refs:
  - git://804a23937 - the merge of ahpio/ahpd#343
  - "[code://packages/sdk/src/host/resourceannotations.ts](../../../../packages/sdk/src/host/resourceannotations.ts) - the comments on a resource, and the comments a session and a file show of each other"
  - "[code://packages/sdk/src/tools/comments.ts](../../../../packages/sdk/src/tools/comments.ts) - the comment tools"
---

People comment on a file outside any session, on `x-ahpd-annotations:<resource URI>`, with AHP's annotation types and reducer.
A file and a session show each other's comments, each comment's range moves with live edits, and the agent's comment tools reach a file's comments.

## What was built

- [`code://packages/sdk/src/host/resourceannotations.ts`](../../../../packages/sdk/src/host/resourceannotations.ts) - the channel's state and actions, and the stamp `_meta.ahpd` on each entry. It moves ranges with live edits, and joins a session's comments and a file's.
- [`code://packages/sdk/src/host/snapshots.ts`](../../../../packages/sdk/src/host/snapshots.ts) - a file's snapshot holds every session's comments on it. A session's snapshot holds the comments outside any session under its folder and on its artifacts.
- [`code://packages/sdk/src/host/actions.ts`](../../../../packages/sdk/src/host/actions.ts) - a reply, a resolve or a delete goes where its comment is kept, with that side's grant.
- [`code://packages/sdk/src/tools/comments.ts`](../../../../packages/sdk/src/tools/comments.ts) - the tools take a `resource`, a file URI or an absolute path, and refuse any other name.
- [`code://packages/server/src/resourceannotationstore.ts`](../../../../packages/server/src/resourceannotationstore.ts) - one JSON file per resource under `~/.config/ahpd/annotations/`.
- [`code://packages/sdk/src/access/users.ts`](../../../../packages/sdk/src/access/users.ts) - `file:comment`, which the read group holds.
- `docs/sdk/SHARED.md`, `docs/sdk/TOOLS.md` and `docs/sdk/USERS.md`.

## Verified

- `packages/sdk/test/resource-annotations.test.ts`, `resource-annotations-gate.test.ts`, `commenttools.test.ts` and `host-handshake.test.ts`.
- The suite at the PR: 9901 pass.
- A test daemon in two browsers, and VS Code with an agent on a real host.

## Departures from the plan

- Tasks 05 and 06 were added during the build, at Softov's request. A session and a file show each other's comments, and a session's comments move with live edits.
- A session's comments stay in the session record, and the host gathers them. One store for every comment was tried first and taken out, because it broke the tests that follow VS Code.

## Left for later

- A session's channel showed a file's comments without checking that the reader may read the file. The fix is on the branch `host/session-comments-need-file-read`, not merged yet.
- A file's channel shows every session's comments on the file to any reader of the file, also comments from sessions that reader cannot see. Nobody has decided whether that is wanted.
