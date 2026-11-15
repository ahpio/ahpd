---
title: A workspace-less case removes its home while a folder in it is busy
status: open
date: 2026-11-14
severity: minor
blocks: []
refs:
  - "[code://packages/sdk/test/host-files.test.ts#L895-L910](../../packages/sdk/test/host-files.test.ts#L895-L910) - \"refuses a folder change to a workspace-less session, in VS Code's words\", which removes its home in `onTestFinished`"
  - git://93b232b89 - the head of #337, where the case failed
---

## Symptom

In run 43652823221 of #337, the rerun of `windows (1/4)` failed the case "refuses a folder change to a workspace-less session, in VS Code's words".
The case's own assertions passed. Its `onTestFinished` failed with `EBUSY: resource busy or locked, rmdir '...\ahpd-home-zssGyT\.copilot\chats\windowed'`.
The first run of the same job passed this case.

## Cause

Unknown. The case makes a workspace-less session, whose folder is under the stubbed home, and removes the home when the case ends.
Nothing in the case closes the session or its host first. Something on Windows still holds the session's folder when `rm` runs.
#337 changes how a turn end settles an automation run, and the case runs no turn.

## Impact

A Windows CI job can fail at random, and block a merge until it runs again.

## Workaround

None. Running the job again is not a fix.

## Fix

- Close the session and its host before the case removes its home.
- Remove the home with `maxRetries`, as `rm` allows on Windows.
