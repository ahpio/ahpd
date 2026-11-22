---
title: A nested chat's changeset URI reaches the outer client unmapped
status: open
date: 2026-11-22
severity: minor
refs:
  - "[code://packages/sdk/test/nested-process.test.ts#L299-L301](../../packages/sdk/test/nested-process.test.ts#L299-L301) - the case that sees it"
  - "[code://packages/sdk/src/sessions/nested.ts](../../packages/sdk/src/sessions/nested.ts) - where an inner host's actions are mapped to the outer chat"
  - git://406667ee0 - #419, which gave each chat changesets under its own URI
---

## Symptom

`nested-process.test.ts` "every chat a turn through a real inner host names is the outer chat" fails at random. It failed on 2026-11-22 in the sdk suite under the lock, on branch `build/agents/9867ea9a`. It passed before on that branch, and on two others the same day:

```
+ [
+   "ahp-chat:/6b7d4c2a-3ad7-4b2d-aa5c-71b12be8fcb7/changeset/uncommitted",
+ ]
```

## Cause

Unknown. The leaked string is an inner chat's changeset URI, of the shape #419 added. A changeset update from the inner host can reach the outer client before, or without, the rename of its chat.

## Impact

A client of a nested session can see a changeset URI of the inner host, which it cannot open.

## Workaround

None.

## Fix

Not decided.
