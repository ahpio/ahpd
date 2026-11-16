---
title: A session and a file show each other's comments
status: done
depends: [task-01-the-annotations-channel.md, task-03-the-tools-take-a-resource.md]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/resourceannotations.ts](../../../../packages/sdk/src/host/resourceannotations.ts) - the comments outside any session, and their fan-out"
  - "[code://packages/sdk/src/host/snapshots.ts#L428-L462](../../../../packages/sdk/src/host/snapshots.ts#L428-L462) - a session's annotations snapshot"
  - "[code://packages/sdk/src/host/actions.ts#L262-L300](../../../../packages/sdk/src/host/actions.ts#L262-L300) - an action on a session's annotations"
  - "https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/node/shared/agentFeedbackServerTools.ts#L21-L23 - VS Code keeps each comment on one session's channel"
---

## Objective

ahpw's file page shows every session's comments on the file, VS Code shows the comments outside any session, and the comment tools take a path.

## Files

- `UPDATE: packages/sdk/src/host/resourceannotations.ts` - the comments outside any session under folders, the file that holds one, and their actions said on the sessions' channels too.
- `UPDATE: packages/sdk/src/host.ts` - each session's folder, and the sessions' channels open on a file's folder.
- `UPDATE: packages/sdk/src/host/snapshots.ts` - a session's snapshot adds the comments outside any session under its folder; a file's snapshot adds every session's comments on it.
- `UPDATE: packages/sdk/src/host/actions.ts` - an action on a file's comment, sent on a session's channel, goes to its file with the file's `comment` grant; a session's entries are stamped.
- `UPDATE: packages/sdk/src/tools/comments.ts` - `resource` takes a file URI or an absolute path, and refuses anything else.
- `UPDATE: packages/sdk/test/resource-annotations.test.ts` - each side shows the other's comments, and a reply goes where its comment is kept.
- `UPDATE: packages/sdk/test/host-handshake.test.ts` - a session's comment is said on its file's channel too, so the replay probe reads the real seq.
- `UPDATE: packages/sdk/test/commenttools.test.ts` - a path as `resource`, and a refused name.
- `UPDATE: docs/sdk/SHARED.md` - what a session shows.
- `UPDATE: docs/sdk/TOOLS.md` - the forms of `resource`.

## Steps

1. Add the comments outside any session, under the session's folder or on its artifacts, to the session's snapshot.
2. Say each action on a file's comments on every session channel open on that file's folder.
3. Send a reply, a resolve or a delete on such a comment to its file, after the file's `comment` grant.
4. Keep a session's comments in its record, and show them on each file's channel.
5. Send an action on a session's comment, from a file's channel, to its session with the session's `review` grant.
6. Turn an absolute path into the file URI in the comment tools, and refuse any other name.

## Validation

- `packages/sdk/test/resource-annotations.test.ts`: the session snapshot lists the file comment.
- The same file: a new file comment reaches the session, and the session's reply stays on the file.
- The same file: a session comment shows on the file, and a reply from the file stays in the session.
- `packages/sdk/test/commenttools.test.ts`: the tools take a path, and refuse a relative path or another scheme.
- VS Code shows a comment made in ahpw on a file of the session.

## Resume

Built on 2026-11-15.
- Where a session works is its live `workingDirectory`, else the one in its record, and the `file:` URIs among its artifacts.
- The channels told are the session annotations channels some connection has open.
- VS Code shows the comment because ahpw writes the feedback meta: `kind`, `state` and `sessionResource`. VS Code does not check which session the meta names.
- One store keyed by the file was built and taken out. VS Code keeps a session's comments in its record, and three tests follow that.
- Not checked in VS Code yet.
