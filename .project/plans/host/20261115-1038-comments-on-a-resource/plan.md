---
title: Comments on a resource, outside any session
domain: host
status: active
priority: medium
created: 2026-11-15
revalidated: 2026-11-15
requires:
  - plans/host/20261115-0829-a-file-is-a-shared-document/plan.md
  - plans/host/20261110-0813-an-agent-reads-and-writes-comments/plan.md
changes: []
creates: []
refs:
  - git://e884e3247 - the commit of ahpd this plan was checked at
  - git://b13753cfe - the shared resource branch this plan moves comment ranges with
  - "[code://packages/sdk/src/host.ts#L632-L651](../../../../packages/sdk/src/host.ts#L632-L651) - `marksOf` and `markAnnotation`: reduce with the protocol's reducer, keep, send; the pattern the resource channel copies"
  - "[code://packages/sdk/src/host/snapshots.ts#L414-L446](../../../../packages/sdk/src/host/snapshots.ts#L414-L446) - a session's annotations served as a channel the host holds"
  - "[code://packages/sdk/src/host/actions.ts#L225-L257](../../../../packages/sdk/src/host/actions.ts#L225-L257) - a client's `annotations/*` action routed to the session's store"
  - "[code://packages/sdk/src/host/gate.ts#L190-L196](../../../../packages/sdk/src/host/gate.ts#L190-L196) - each `annotations/*` action needs `session:review` today"
  - "[code://packages/sdk/src/host/gate.ts#L382-L392](../../../../packages/sdk/src/host/gate.ts#L382-L392) - `ACTION_HOMES`: the `annotations` family belongs on a session"
  - "[code://packages/sdk/src/access/users.ts#L109-L113](../../../../packages/sdk/src/access/users.ts#L109-L113) - `RESOURCE`, the operations of `file:` and every resource scheme, in their read and write groups"
  - "[code://packages/sdk/src/tools/comments.ts#L508-L558](../../../../packages/sdk/src/tools/comments.ts#L508-L558) - the six comment tools, which read and write the session's channel through `at.annotations` and `at.markAnnotation`"
  - "[code://packages/sdk/src/types/host.ts#L1911-L1921](../../../../packages/sdk/src/types/host.ts#L1911-L1921) - what a tool is given to reach the session's annotations"
  - "[code://packages/sdk/src/types/sessions.ts#L635-L637](../../../../packages/sdk/src/types/sessions.ts#L635-L637) - the session store keeps annotations on a session's row, so a resource's need a store of their own"
  - https://github.com/microsoft/agent-host-protocol/tree/2c37a04f/types/channels-annotations - the annotations type, its five actions and its reducer
  - https://github.com/microsoft/vscode/blob/171e90619c723a84a3e1c7bcd58d226698f55c72/src/vs/platform/agentHost/node/shared/agentFeedbackServerTools.ts - VS Code's comment tools, whose names and text the tools keep
---

## Goal

People and agents comment on a file and reply, whoever opened it and from whichever session.
A comment stays on its words while the file is edited live.
An agent sees the comments on the files of its session, and answers them with the comment tools it has.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `git grep -n "annotations" -- packages/sdk/src/host` - the only annotations channel is `<session>/annotations`, kept on the session's row.
- `git grep -n "groups:" -- packages/sdk/src/access/users.ts` - every resource scheme shares one operation list, so a new operation reaches `file:` and every other scheme at once.
- VS Code at `171e90619`: the tools are named for comments (`addComment`, `listComments`, ...); the data is the protocol's `Annotation` with `_meta['vscode.agentFeedback']`.

### Runtime path

```
subscribe x-ahpd-annotations:<uri> -> the resource's annotations from the store
dispatchAction annotations/* on it -> grant <scheme>:comment -> stamp the author -> reduce -> keep -> emit
a change taken on x-ahpd-shared:<uri> -> each range moved -> annotations/updated
addComment { resource } -> the same writer
```

### Gaps

- No channel holds comments on a resource outside a session.
- `ACTION_HOMES` puts every `annotations/*` action on a session.
- An entry's author is `user` or `agent`, never which person, and nothing says when.
- No range moves when its text does.
- The comment tools reach only the session's own channel.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The channel is `x-ahpd-annotations:<resource URI>`, apart from the edits on `x-ahpd-shared:` | Softov, 2026-11-15, chose "x-ahpd-annotations:<uri>" | 01 |
| Its state, actions and reducer are AHP's own annotations | Softov, 2026-11-15: "we need to follow the spec onto the Annotations" | 01 |
| `origin.session` is the commenter's session when there is one, else the channel's own URI; the host refuses any other value | Softov, 2026-11-15, chose "B: channel per file, spec type" | 01 |
| A new operation `comment` for every resource, in the read group, so who may read a file may comment; a role can drop it | Softov, 2026-11-15, chose "New file:comment, in read" | 01 |
| Reading the channel needs `<scheme>:get`; each `annotations/*` action on it needs `<scheme>:comment` | `(defaulted: a read of the comments is a read of the resource)` | 01 |
| The host stamps each new entry's `_meta.ahpd` with `by`, `name` and `at`, from the connection, as the shared resource names a person | `(defaulted: a client's word for who wrote it is not trusted, and many people comment)` | 01 |
| The comments are kept in one JSON file per resource in the state folder, through a port the server gives; with no port they live in memory | `(defaulted: the session store keeps annotations on a session's row, and a resource has none)` | 01 |
| A range moves with each change taken on the resource's shared channel; a range whose text is deleted becomes a point at the deletion, with `_meta.ahpd.outdated` true | Softov, 2026-11-15, chose "Move with edits" | 02 |
| An edit made while nobody has the resource open as shared does not move a range | `(defaulted: only the shared channel knows the change)` | 02 |
| The six comment tools take an optional `resource`; `listComments` in a session also lists the comments on files under its folders | Softov, 2026-11-15, chose "Yes, tools take a resource" | 03 |
| The tools keep VS Code's names and text, with one line on `resource` | the plan `host/20261110-0813-an-agent-reads-and-writes-comments` | 03 |

## Proposed architecture

- **Data flow** - a resource's annotations live in a store keyed by resource URI. The host reads them at the first subscribe, reduces every action with the protocol's `annotationsReducer`, and writes them back.
- **Event flow** - a client's `annotations/*` action on `x-ahpd-annotations:<uri>`, or a tool's, goes through one writer: grant, origin check, author stamp, reduce, keep, emit. The shared resource tells the writer of each change it takes, and the writer emits `annotations/updated` for each range that moved.
- **State flow** - the store holds the comments; the channel's snapshot is the store's state for the URI.
- **Layer responsibilities** - `packages/sdk/src/host/resourceannotations.ts`: the channel and its writer. `packages/sdk/src/host/shared.ts`: tells the writer of each change. `packages/sdk/src/tools/comments.ts`: the `resource` parameter. `packages/server`: the JSON store.
- **Source-of-truth files** - [`code://packages/sdk/src/host/resourceannotations.ts`](../../../../packages/sdk/src/host/resourceannotations.ts) for the channel's rules.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The annotations channel of a resource](task-01-the-annotations-channel.md) | implemented | - |
| [02 - Ranges move with the edits](task-02-ranges-move-with-the-edits.md) | implemented | 01 |
| [03 - The comment tools take a resource](task-03-the-tools-take-a-resource.md) | implemented | 01 |
| [04 - The comments in the docs](task-04-the-comments-in-the-docs.md) | implemented | 03 |

## Risks and tradeoffs

- A comment made outside a session holds the channel's URI as `origin.session` - ask AHP to make the field optional once this works.
- A range counts lines and characters, and a change counts offsets - the writer converts with the text before and after.
- VS Code does not draw `x-ahpd-annotations:` - its comments stay on the session's channel, which this plan does not change.

## Resume state

- **Done so far:** tasks 01 to 04 built on 2026-11-15, on branch `host/20261115-1038-comments-on-a-resource`, stacked on the shared resource branch.
- **Next action:** plan `shell/20261115-1038-comments-in-a-file`; then Softov tests both.
- **Open questions:** none.
- **Watch out for:** `ACTION_HOMES` refuses an `annotations/*` action on any channel that is not a session's; task 01 opens it for the resource channel. Plan `host/20261115-0829` is not merged yet: build on its branch.

## Final verification checklist

- [ ] Two clients subscribe to one file's comments, and each sees the other's comment, reply and resolve.
- [ ] A reader with `file:comment` and without `file:put` comments; one without `file:comment` is refused.
- [ ] Each new entry carries the person and the time, set by the host.
- [ ] A comment's range moves with a live edit before it, and becomes an outdated point when its text is deleted.
- [ ] An agent in a session lists, answers and resolves a comment on a file under its folders.
- [ ] The comments outlive a restart of the host.
- [ ] `pnpm test`, the conformance and wire suites, and the computer suite pass.
