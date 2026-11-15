---
title: The comment tools take a resource
status: todo
depends: [task-01-the-annotations-channel.md]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/tools/comments.ts#L508-L558](../../../../packages/sdk/src/tools/comments.ts#L508-L558) - the six tools"
  - "[code://packages/sdk/src/types/host.ts#L1911-L1921](../../../../packages/sdk/src/types/host.ts#L1911-L1921) - what a tool reaches"
---

## Objective

An agent reads, answers and resolves the comments on a file of its session with the comment tools it already has.

## Files

- `UPDATE: packages/sdk/src/tools/comments.ts` - an optional `resource` on each tool; `listComments` also lists the comments on files under the session's folders.
- `UPDATE: packages/sdk/src/types/host.ts` - the tool context reaches a resource's annotations and its writer.
- `UPDATE: packages/sdk/src/host/tooling.ts` - give the tools the resource channel's state and writer.
- `UPDATE: packages/sdk/test/commenttools.test.ts` - the tools on a resource.

## Steps

1. Give the tool context `annotationsOf(resource)` and `markResourceAnnotation(resource, action)`, through the writer of task 01.
2. Add an optional `resource` to each of the six tools; with it, the tool reads and writes that resource's channel.
3. Without it, keep today's behaviour on the session's channel.
4. In `listComments` with no `resource`, also list the comments on resources under the session's folders, each with its resource.
5. Keep VS Code's names and text; add one line to each tool's text on `resource`.
6. Stamp the agent's entries as task 01 stamps a person's, with the session as `by`.

## Validation

- `packages/sdk/test/commenttools.test.ts`: `addComment` with a `resource` writes on its channel, and a subscriber sees it.
- The same file: `listComments` in a session lists a comment on a file under its folder, with the resource.
- The same file: `replyToComment` and `resolveComments` on a resource's comment reach its channel.
- The same file: the tools without `resource` behave as before.
- `pnpm test packages/sdk/test/commenttools.test.ts` passes.

## Resume
