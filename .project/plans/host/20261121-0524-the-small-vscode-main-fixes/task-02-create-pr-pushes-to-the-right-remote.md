---
title: Create PR pushes to the right remote
status: todo
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/sessions/changes.ts#L1291-L1299](../../../../packages/sdk/src/sessions/changes.ts#L1291-L1299) - the push"
  - git://github.com/microsoft/vscode@1808c5c2a55e - the order of remotes
---

## Objective

Create PR pushes a branch with no upstream to the remote VS Code chooses, and the PR names that remote's owner as its head owner.

## Files

- `UPDATE: packages/sdk/src/sessions/changes.ts:1291-1299` - the remote is chosen in VS Code's order.
- `UPDATE: packages/sdk/test/pullrequest.test.ts` - the remote cases.

## Steps

1. Read VS Code `1808c5c2a55e`, and record its order and its head owner rule in Resume.
2. Choose the remote: the branch's push remote, the GitHub remote with `origin` first, `origin`, then the only remote.
3. Name the head with the owner of that remote where it is not the base repository's owner.

## Validation

- `packages/sdk/test/pullrequest.test.ts` - a repository with only `upstream` pushes there; one with `origin` pushes to `origin`.
- The sdk vitest suite passes.

## Resume
