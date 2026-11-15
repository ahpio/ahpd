---
title: A recorded pull request never shows merged
status: open
date: 2026-11-15
severity: minor
blocks: []
refs:
  - "[code://packages/sdk/src/host/facts.ts#L598-L668](../../packages/sdk/src/host/facts.ts#L598-L668) - `refreshPullRequests`, which reads the state of the folder's own branch only"
  - "[code://packages/sdk/src/tools/artifacts.ts#L5-L16](../../packages/sdk/src/tools/artifacts.ts#L5-L16) - an artifact entry, which holds a label and a link and no state"
  - git://2c6a13689 - main when the problem was read
---

## Symptom

Seen by Softov on 2026-11-15, in a session whose folder is `/github/ahpd` on `main`.
The session merged #349 with `gh pr merge`, and GitHub says #349 is merged.
The session's list of pull requests still showed #349 the same way as before the merge.
Its #344 entry reads "(merged, with two commits)", which is not GitHub's title of #344 but the label the agent wrote.

## Cause

The session built #349 on its own branch, `host/20261115-1940-instructions-read-apart-from-the-person`, in a worktree outside its folder.
The host asks GitHub only for the pull request of the branch the folder has checked out, and keeps that one's state as `pullRequestState`.
An agent records a pull request with the artifact tools as an entry with a label and a link.
The host never reads the state of such an entry.
So a pull request of another branch shows only the label the agent gave it, and a merge does not change it.

## Impact

A person reads an open pull request where GitHub has merged it, unless the agent wrote the state into the label itself.

## Workaround

None.

## Fix

Undecided.
- Read the state of each recorded pull request when the folder's facts are read, and send it with the entry.
- Or keep the entry as it is, and let the client ask GitHub for the state.
- Check what VS Code's host does for a pull request artifact of another branch before choosing.
