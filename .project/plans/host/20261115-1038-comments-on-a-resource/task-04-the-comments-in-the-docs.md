---
title: The comments in the docs
status: done
depends: [task-03-the-tools-take-a-resource.md]
layer: "docs"
refs:
  - "[code://docs/sdk/TOOLS.md](../../../../docs/sdk/TOOLS.md) - the comment tools' page"
---

## Objective

A client author reads how to show and write comments on a resource, and an agent author reads the `resource` parameter.

## Files

- `UPDATE: docs/sdk/SHARED.md` - a *Comments* section: the channel, its grants, the author stamp, ranges that move.
- `UPDATE: docs/sdk/TOOLS.md` - the `resource` parameter of the comment tools.
- `UPDATE: docs/sdk/USERS.md` - the `comment` operation.

## Steps

1. Write the *Comments* section in `SHARED.md` with one example: a subscribe, an `annotations/set`, and the stamped entry.
2. Add `resource` to each comment tool in `TOOLS.md`.
3. Add `comment` to the resource operations in `USERS.md`.

## Validation

- `node <do-spec>/scripts/lint-prose.mjs` passes on the changed sections.
- The docs build passes.

## Resume

Built on 2026-11-15: a *Comments* section in `docs/sdk/SHARED.md`, a paragraph in `docs/sdk/TOOLS.md`, and `comment` in the `file` row of `docs/sdk/USERS.md`.
