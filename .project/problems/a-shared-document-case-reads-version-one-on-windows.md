---
title: A shared document case reads version 1 on Windows
status: open
date: 2026-11-15
severity: minor
blocks: []
refs:
  - "[code://packages/sdk/test/shared.test.ts#L202-L213](../../packages/sdk/test/shared.test.ts#L202-L213) - \"writes the text and lets the document go when the last person leaves\""
  - git://b0176675c - the head of #345, where the case failed
---

## Symptom

On 2026-11-15 the case failed in `windows (2/4)` of CI run 43750664597, on the head of #345.
That PR does not change the shared documents.
The later subscriber got the text it expects, but at `version: 1` in place of `version: 0`.
The case passed on main at `804a23937`, on Linux and on Windows.

## Cause

Unknown.
The case sends the unsubscribe without waiting for it, and then waits only until the file holds the text.
So the second subscriber can join before the host lets the first document go, and read that document at version 1.

## Impact

`check-windows` is red at random, which blocks a merge.

## Workaround

None. A second run is not a fix.

## Fix

- Find when the host lets the document go after the last unsubscribe.
- Make the case wait for that before the second subscriber joins.
