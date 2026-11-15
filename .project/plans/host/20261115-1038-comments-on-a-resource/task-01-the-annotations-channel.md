---
title: The annotations channel of a resource
status: implemented
depends: []
layer: "sdk, server"
refs:
  - "[code://packages/sdk/src/host.ts#L632-L651](../../../../packages/sdk/src/host.ts#L632-L651) - the session's writer, the pattern"
  - "[code://packages/sdk/src/host/actions.ts#L225-L257](../../../../packages/sdk/src/host/actions.ts#L225-L257) - where a client's `annotations/*` action is routed"
  - "[code://packages/sdk/src/host/gate.ts#L382-L392](../../../../packages/sdk/src/host/gate.ts#L382-L392) - `ACTION_HOMES`"
  - "[code://packages/sdk/src/access/users.ts#L109-L113](../../../../packages/sdk/src/access/users.ts#L109-L113) - `RESOURCE` operations"
---

## Objective

A client subscribes to `x-ahpd-annotations:<resource URI>` and gets the comments on that resource.
It adds, replies, resolves and removes them with AHP's own `annotations/*` actions, and every subscriber sees each one.

## Files

- `CREATE: packages/sdk/src/host/resourceannotations.ts` - the channel: the snapshot, the writer, the origin check and the author stamp.
- `UPDATE: packages/sdk/src/host/channels.ts` - the scheme, and the resource a channel names; the scheme is the host's own space.
- `UPDATE: packages/sdk/src/host/snapshots.ts` - serve the scheme.
- `UPDATE: packages/sdk/src/host/actions.ts` - route `annotations/*` on the scheme to the writer.
- `UPDATE: packages/sdk/src/host/gate.ts` - the subscribe needs `<scheme>:get`; each action on the scheme needs `<scheme>:comment`, not `session:review`; the home check takes the scheme for the `annotations` family.
- `UPDATE: packages/sdk/src/access/users.ts` - `comment` in `RESOURCE`, in the read group.
- `UPDATE: packages/sdk/src/types/host.ts` - `HostOptions.resourceAnnotations`, the store port.
- `CREATE: packages/server/src/resourceannotations.ts` - the store: one JSON file per resource under the state folder.
- `UPDATE: packages/server/src/main.ts` - give the host the store.
- `CREATE: packages/sdk/test/resource-annotations.test.ts` - the channel through the scenario client.

## Steps

1. Add `ANNOTATIONS_SCHEME = 'x-ahpd-annotations'` and `annotatedResourceOf(channel)` to `channels.ts`, and make the scheme the host's own space.
2. Define the store port: `read(uri)` and `write(uri, state)`, and a memory store for a host given none.
3. At the first subscribe, read the state from the store; answer the snapshot with it.
4. Route each `annotations/*` action on the scheme to one writer, which a tool reaches too.
5. In the writer, refuse an `origin.session` that is neither one of the sender's sessions nor the channel's URI.
6. Stamp each new entry's `_meta.ahpd` with `by`, `name` and `at`.
7. Take `by` and `name` as the shared resource names a person.
8. Reduce with `annotationsReducer`, keep the state through the store, and emit the action.
9. Add `comment` to `RESOURCE` and its read group.
10. Gate the subscribe with `<scheme>:get` and each action with `<scheme>:comment`.
11. Let the `annotations` family on this scheme pass the home check.
12. Write the server's store: one JSON file per resource, its name a hash of the URI, under `<state>/annotations/`.

## Validation

- `packages/sdk/test/resource-annotations.test.ts`: two clients subscribe; a comment, a reply, a resolve and a remove reach both.
- The same file: an entry carries `_meta.ahpd.by`, `name` and `at` set by the host, whatever the client wrote there.
- The same file: the host refuses an `origin.session` that is another person's session.
- The same file: a reader with `file:comment` and no `file:put` comments, and the host refuses one without `file:comment`.
- The same file: a second host given the same store reads the comments back.
- `pnpm test packages/sdk/test/resource-annotations.test.ts` passes.

## Resume

Built on 2026-11-15, on branch `host/20261115-1038-comments-on-a-resource`, stacked on the shared resource branch.
- The store port is synchronous: `read`, `write` and an optional `list`, which `listComments` needs to find the files under a session's folders.
- The stamp takes the person from `personOf` in `shared.ts`: `by` is `user:<id>`, `root:<client>` or `guest:<client>`, and a tool's is `session:<uri>` with the name `agent`.
- The home check and the grant check each take the channel by name, since `ACTION_HOMES` and `ACTION_NEEDS` are keyed by the action alone.
