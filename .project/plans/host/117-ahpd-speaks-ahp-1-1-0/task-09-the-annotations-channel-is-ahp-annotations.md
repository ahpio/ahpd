---
title: The annotations channel is ahp-annotations
status: todo
depends: [01]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/channels.ts#L39-L43](../../../../packages/sdk/src/host/channels.ts#L39-L43) - `ANNOTATIONS_PATH_SEGMENT`, the `<session>/annotations` shape"
  - "[code://packages/sdk/src/host/actions.ts#L264-L268](../../../../packages/sdk/src/host/actions.ts#L264-L268) - the check that an annotations action is on that channel"
  - "[code://packages/sdk/src/host/snapshots.ts#L443-L460](../../../../packages/sdk/src/host/snapshots.ts#L443-L460) - the annotations snapshot"
  - "[code://packages/sdk/src/host/sleep.ts#L126](../../../../packages/sdk/src/host/sleep.ts#L126) - the channel read as a session's own"
  - "[code://packages/sdk/src/host.ts#L656](../../../../packages/sdk/src/host.ts#L656) - a dispatch on the channel"
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `buildAnnotationsUri` gives `ahp-annotations:/<uuid>`, and `parseAnnotationsUri` still reads the old suffix
  - git://github.com/microsoft/vscode@c4453f8ea430 - VS Code 1.145.2, which still builds `<session>/annotations` itself
---

## Objective

A session's annotations channel is `ahp-annotations:/<uuid>`, with the session's id, and the session's state names it in `annotations.resource`.
The old `<session>/annotations` name still works, because VS Code 1.145.2 builds it itself.

## Files

- `CREATE: packages/sdk/test/host-annotations-channel.test.ts` - the cases for both names.
- `UPDATE: packages/sdk/src/host/channels.ts:39-43` - a function that makes and one that parses `ahp-annotations:/<uuid>`, beside the old suffix.
- `UPDATE: packages/sdk/src/host/actions.ts:264-268` - the check takes both names.
- `UPDATE: packages/sdk/src/host/snapshots.ts:443-460` - the snapshot answers both names.
- `UPDATE: packages/sdk/src/host/sleep.ts:126` - both names are a session's own.
- `UPDATE: packages/sdk/src/host.ts` - each use of `ANNOTATIONS_PATH_SEGMENT` takes both names, and an action is sent to each subscribed name.
- `UPDATE: packages/sdk/src/sessions/sessions.ts` - the session's state carries `annotations` with `resource`, `annotationCount` and `entryCount`.

## Steps

1. Add `annotationsChannelOf(session)` and `sessionOfAnnotations(channel)` to `channels.ts`, for both names.
2. Replace each `endsWith(ANNOTATIONS_PATH_SEGMENT)` with `sessionOfAnnotations`.
3. Send each annotations action to every name a client subscribed to.
4. Put `annotations` in the session's state, with `resource` as the `ahp-annotations:` name and both counts.
5. Run `rg "/annotations" ../ahpw/src ../ahpc/src`, and record in Resume whether a client builds the name itself.

## Validation

- `packages/sdk/test/host-annotations-channel.test.ts` - a client subscribed to `ahp-annotations:/<uuid>` and one on `<session>/annotations` both get the snapshot and each action.
- The same file - the session's state names `ahp-annotations:/<uuid>` in `annotations.resource`, with both counts.
- The sdk vitest suite passes.

## Resume
