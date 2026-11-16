---
title: Ranges move with the edits
status: done
depends: [task-01-the-annotations-channel.md]
layer: "sdk"
refs:
  - "git://b13753cfe - `packages/sdk/src/host/shared.ts`, where each change is taken, and `textchanges.ts`, `mapPosition`"
---

## Objective

While a file is open as a shared resource, each comment's range moves with the edits before it.
A range whose text is deleted becomes a point, marked outdated, and the comment stays.

## Files

- `UPDATE: packages/sdk/src/host/shared.ts` - tell the annotations writer of each change taken, with the text before and after it.
- `UPDATE: packages/sdk/src/host/resourceannotations.ts` - move each range through the change and emit `annotations/updated` for each one that moved.
- `UPDATE: packages/sdk/test/resource-annotations.test.ts` - ranges through live edits.

## Steps

1. Add a port to the shared resources that reports each change taken.
2. Give the port the resource URI, the change, and the text before and after it.
3. In the writer, turn each range's `start` and `end` into offsets in the text before.
4. Map the start with `assoc` 1 and the end with `assoc` -1 through the change.
5. Turn them back into a line and a character in the text after.
6. When the change deleted the whole range, make it a point there and set `_meta.ahpd.outdated` to true.
7. Emit one `annotations/updated` for each range that moved, with no `origin`, and keep the state.
8. Leave a comment with no range as it is.

## Validation

- `packages/sdk/test/resource-annotations.test.ts`: an insert before a comment moves its range by the lines and characters it added.
- The same file: an edit after a comment leaves it where it is.
- The same file: a delete of a comment's whole text leaves a point marked outdated, and the thread stays.
- `pnpm test packages/sdk/test/resource-annotations.test.ts` passes.

## Resume

Built on 2026-11-15.
- The shared resources tell the writer of each change through an optional `taken` port.
- The port is told after the change is sent, so a client has the new text before the moved range. A two-browser run found a range moved twice in the other order.
- An outdated comment is written as one `annotations/set` with the point and `_meta.ahpd.outdated`, since `annotations/updated` carries no `_meta`.
