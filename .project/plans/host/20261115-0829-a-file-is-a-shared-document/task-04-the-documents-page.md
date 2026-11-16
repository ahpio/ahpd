---
title: The documents page
status: done
depends: [task-03-the-file-on-disk.md]
layer: "docs"
refs:
  - "[code://docs/sdk/RESOURCES.md](../../../../docs/sdk/RESOURCES.md) - the page beside which the documents page goes"
  - "[code://docs/updates/v0_15.md](../../../../docs/updates/v0_15.md) - the release notes"
---

## Objective

A client author reads how to open a shared document, send changes and carets, and read the people in it.

## Files

- `CREATE: docs/sdk/DOCUMENTS.md` - the channel, its state, its actions, the rules, and an example of two people typing at once.
- `UPDATE: docs/updates/v0_15.md` - one entry for shared documents.
- `UPDATE: docs/sdk/RESOURCES.md` - a link to the documents page.

## Steps

1. Write `DOCUMENTS.md` from the plan's *The channel* tables and task 02's rules.
2. Add an example: a subscribe, a snapshot, two changes on one version, and the second rebased.
3. Add one entry to `v0_15.md`, and a link from `RESOURCES.md`.

## Validation

- `node <do-spec>/scripts/lint-prose.mjs docs/sdk/DOCUMENTS.md` passes.
- The docs build passes.

## Resume

Built on 2026-11-15.
- `docs/sdk/DOCUMENTS.md` is in the docs sidebar, and `RESOURCES.md` links it.
- No entry in `docs/updates/v0_15.md`: the release notes are written when a release is cut.
