---
title: A file watch hears the file
status: implemented
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/resources/resources.ts](../../../../packages/sdk/src/resources/resources.ts) - `watch`, which joined the event name onto a file's path"
---

## Objective

A resource watch on one file reports an edit as `updated`.
It keeps hearing the file after a save that renames a new file over it.
It reports nothing else in the file's folder.

## Files

- `UPDATE: packages/sdk/src/resources/resources.ts` - a watch on a file is kept on its folder, for the file's name.
- `UPDATE: packages/sdk/test/watches.test.ts` - an edit, a save by rename, a sibling and a delete under a watch on one file.
- `UPDATE: docs/sdk/RESOURCES.md` - a watch on one file.
- `UPDATE: docs/updates/v0_15.md` - the fix.

## Steps

1. Read whether the watched path is a folder, from the `stat` the watch already makes.
2. Watch a file's folder, not recursively, and report only the file's own name.
3. Keep a folder's watch as it was.

## Validation

- `watches.test.ts` passes, and its file case fails on the code before the fix.

## Resume

Built on 2026-11-16. `node:fs.watch` on a file names the file in each event.
The old code joined that name onto the file's own path, a path that is not there, so each change was said as `deleted`.
