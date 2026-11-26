---
title: A folder is cleared in one call
status: todo
depends: []
layer: "tools"
---

## Objective

`clearFolder(folder)` ends the folder's holders, then removes it with retries, in one synchronous call.

## Files

- `UPDATE: tools/holders.ts` - `endHoldersNow`, a synchronous `endHolders`, and `clearFolder`.
- `CREATE: tools/holders.test.ts` - the cases.

## Steps

1. Write `endHoldersNow(folders, ms)`, which waits between rounds with `Atomics.wait`.
2. Write `clearFolder(folder)`, which calls `endHoldersNow` and then `removeFolder`.

## Validation

- The call ends a child whose environment names the folder, and the folder is gone after it.
- A folder that is not there is not an error.

## Resume
