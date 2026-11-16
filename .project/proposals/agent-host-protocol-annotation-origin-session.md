---
title: A comment on a file outside any session has no session to name
target: https://github.com/microsoft/agent-host-protocol
date: 2026-11-16
refs:
  - https://github.com/microsoft/agent-host-protocol/blob/1ef06429/types/channels-annotations/state.ts#L57-L64 - `AnnotationOrigin`, with `session` required
  - "[code://packages/sdk/src/host/resourceannotations.ts](../../packages/sdk/src/host/resourceannotations.ts) - ahpd's comments on a resource outside any session, with the spec's state, actions and reducer"
---

## Summary

`AnnotationOrigin.session` is required, so every annotation belongs to a session.
A host that lets people comment on a file outside any session has nothing true to put there.

ahpd serves such comments on a channel per file, `x-ahpd-annotations:<file URI>`, with the spec's `AnnotationsState`, actions and reducer.
A client draws a file's comments and a session's the same way.
Because the field is required, a comment made there sets `origin.session` to the channel's own URI.

## What is being asked

Make `AnnotationOrigin.session` optional.
An annotation with no `session` is not tied to a session's work.
`chat` and `turnId` keep their meaning, and only make sense with a `session`.
The reducer needs no change.
