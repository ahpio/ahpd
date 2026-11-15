---
title: Nested-process cases write checkpoints into the repository
status: open
date: 2026-11-15
severity: minor
blocks: []
refs:
  - "[code://packages/sdk/test/nested-process.test.ts](../../packages/sdk/test/nested-process.test.ts) - each inner host runs with the repository as its folder"
  - "[code://packages/sdk/src/sessions/checkpoints.ts#L93-L121](../../packages/sdk/src/sessions/checkpoints.ts#L93-L121) - `writeTree`, which writes a ref under `refs/agents/` for each turn"
  - git://4d4404550 - main when the problem was read
---

## Symptom

On 2026-11-15 the repository of `/github/ahpd` held five refs from these cases.
They are `refs/agents/nested-outer/checkpoints/turn/0`, `t1` and `t2`, `refs/agents/kept-here/checkpoints/turn/0` and `refs/agents/one/checkpoints/turn/t1`.
The inner hosts of the cases also run `git status`, `git add -A` and `gh pr list` on the repository.

## Cause

Each inner host is started with the repository as its working folder.
So a turn writes a checkpoint of the repository, as a session there would.

## Impact

A test run leaves refs in the repository it runs from, and asks GitHub for the branch's pull requests.
The checkpoint uses its own index, so the branch, the index and the working tree do not change.

## Workaround

`git for-each-ref --format='%(refname)' refs/agents/nested-outer refs/agents/kept-here refs/agents/one` lists them, and `git update-ref -d` removes each.

## Fix

Undecided.
- Start the inner hosts in a temporary repository of their own.
- Or turn checkpoints and the pull request lookup off for those hosts.
