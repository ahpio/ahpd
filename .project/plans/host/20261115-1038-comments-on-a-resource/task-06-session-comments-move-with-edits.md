---
title: A session's comments move with the edits
status: implemented
depends: [task-02-ranges-move-with-the-edits.md, task-05-a-session-shows-the-file-comments.md]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/resourceannotations.ts](../../../../packages/sdk/src/host/resourceannotations.ts) - `moved`, which moves only the comments kept on the file"
  - "[code://packages/sdk/src/host.ts](../../../../packages/sdk/src/host.ts) - `markAnnotation`, the writer of a session's comments"
---

## Objective

A session's comment on a file stays on its words while people edit the file live.

## Files

- `UPDATE: packages/sdk/src/host/resourceannotations.ts` - `moved` also moves each session's comments on the resource.
- `UPDATE: packages/sdk/src/host.ts` - write each moved session comment through `markAnnotation`, by the `markSession` port.
- `UPDATE: packages/sdk/test/resource-annotations.test.ts` - a session's comment moves with a live edit above it, and becomes an outdated point when its words go.

## Steps

1. Move each session's comments on the resource through the change, as task 02 moves the file's own.
2. Write each moved range to its session with `annotations/updated`, or `annotations/set` for an outdated point.
3. Leave a resolved comment where it is, as task 02 does.

## Validation

- `packages/sdk/test/resource-annotations.test.ts`: a new line above a session's comment moves it from line 1 to line 2.
- The same file: deleting a session comment's words makes it an outdated point, with its thread.
- VS Code and ahpw show the moved comment on its words.

## Resume

Built on 2026-11-15.
- One function, `movedBy`, gives the action for a file's comment and for a session's.
- A moved session comment goes out on the session's channel and on the file's channel, as any session comment does.
- Not checked in VS Code yet.
