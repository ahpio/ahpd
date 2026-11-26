---
title: Every teardown clears its folder
status: done
depends:
  - task-01-a-folder-is-cleared-in-one-call.md
layer: "tests"
---

## Objective

Each removal of a temp folder in a teardown uses `clearFolder`, and a test keeps it so.

## Files

- `UPDATE: packages/*/test` - each teardown removal.
- `CREATE: tools/teardown-check.test.ts` - the check of every test file.

## Steps

1. Find each `rmSync(..., { recursive: true })` in an `afterEach`, `afterAll` or `finally` block of a test.
2. Replace it with `clearFolder`, and import it.
3. Leave a removal in the middle of a case as it is.
4. Write the check, which fails on a bare removal in a teardown and names its file and line.

## Validation

- The check passes on the whole tree.
- The full suite passes on Linux, and `check-windows` passes.

## Resume

Built on 2026-11-26.
