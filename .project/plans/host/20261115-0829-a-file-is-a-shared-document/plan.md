---
title: A file is a shared document
domain: host
status: active
priority: medium
created: 2026-11-15
revalidated: 2026-11-15
requires: []
changes: []
creates: []
refs:
  - git://dadf62201 - the commit of ahpd this plan was checked at
  - "[code://packages/sdk/src/types/resources.ts#L133-L256](../../../../packages/sdk/src/types/resources.ts#L133-L256) - `ResourceStore`, the port the document reads, writes and watches the file through"
  - "[code://packages/sdk/src/host/resourcemethods.ts#L63-L78](../../../../packages/sdk/src/host/resourcemethods.ts#L63-L78) - `storeFor`, which store serves a URI"
  - "[code://packages/sdk/src/host/gate.ts#L32-L43](../../../../packages/sdk/src/host/gate.ts#L32-L43) - `NEEDS`: `file:get` to read a file and `file:put` to write it"
  - "[code://packages/sdk/src/host/gate.ts#L149](../../../../packages/sdk/src/host/gate.ts#L149) - `ACTION_NEEDS`, the grant each client action needs"
  - "[code://packages/sdk/src/host/gate.ts#L266-L273](../../../../packages/sdk/src/host/gate.ts#L266-L273) - `channelRead`, the grant a subscribe needs"
  - "[code://packages/sdk/src/host/gate.ts#L382-L392](../../../../packages/sdk/src/host/gate.ts#L382-L392) - `ACTION_HOMES`, the kind of channel each action family belongs on"
  - "[code://packages/sdk/src/host/actions.ts#L33-L36](../../../../packages/sdk/src/host/actions.ts#L33-L36) - `dispatchable`, the action types a client may send"
  - "[code://packages/sdk/src/host/actions.ts#L239-L257](../../../../packages/sdk/src/host/actions.ts#L239-L257) - a client's annotation action routed to the host's store, the pattern a document action copies"
  - "[code://packages/sdk/src/host/snapshots.ts#L414-L446](../../../../packages/sdk/src/host/snapshots.ts#L414-L446) - a session's annotations served as a channel the host holds, the pattern the document channel copies"
  - "[code://packages/sdk/src/host.ts#L632-L651](../../../../packages/sdk/src/host.ts#L632-L651) - `markAnnotation`: reduce, keep and send one action"
  - "[code://packages/sdk/src/host.ts#L834-L918](../../../../packages/sdk/src/host.ts#L834-L918) - `emit`, which puts every action in the replay buffer"
  - "[code://packages/sdk/src/host.ts#L1225](../../../../packages/sdk/src/host.ts#L1225) - where a plugin channel is told a client left"
  - "[code://packages/sdk/src/host.ts#L2195-L2210](../../../../packages/sdk/src/host.ts#L2195-L2210) - the close steps, where open documents are written"
  - "[code://packages/sdk/src/host/handshake.ts#L697-L722](../../../../packages/sdk/src/host/handshake.ts#L697-L722) - a reconnect's `missing` list"
  - https://github.com/microsoft/agent-host-protocol/blob/2c37a04f/docs/specification/subscriptions.md - the action envelope: `origin` set by the server, `rejectionReason` on a refused client action
  - https://github.com/microsoft/agent-host-protocol/blob/2c37a04f/docs/specification/session-channel.md - a server checks each client action and echoes an invalid one with `rejectionReason`
---

## Goal

Several people, and an agent, open the same file and work in it together.
Each one sees who else is in it, where their carets are, and each edit as it lands.
The host holds the text while anyone has the file open, puts the edits in order, and writes the file.
An agent edits the file with its own tools, and the people see the edit in place.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "resourceRead|resourceWrite|createResourceWatch" packages/sdk/src/host` - the host reaches a file only through the `resources` port. `file:get` and `file:put` gate a read and a write.
- `rg "markAnnotation" packages/sdk/src` - a session's annotations are a channel the host holds, takes client actions on, keeps and sends. The document channel is the second instance of that shape.
- `rg "missing" packages/sdk/src/host/handshake.ts` - a reconnect lists the channels it cannot resume, and the client subscribes to them again.
- `rg "x-ahpd" packages/sdk/src/host/actions.ts` - no `x-` action is dispatchable today.
- `rg -i "color" packages/sdk/src/types/users.ts` - a principal has an `id` and no display name or colour. ahpw derives a colour from a name with `textToColor`.

### Runtime path

```
subscribe x-ahpd-document:<file URI> -> read the file through `resources` -> snapshot { text, version, people }
dispatchAction x-ahpd-document/changed -> rebase -> apply -> emit to every subscriber -> write the file after 2 s
the file changes on disk -> watch -> one change on the version last written -> rebase -> emit
```

### Gaps

- No channel holds a file's text for several clients.
- No action carries an edit or a caret.
- No `x-` action is dispatchable, and `ACTION_HOMES` has no home for one.
- `emit` keeps every action for replay, so a busy document would push other channels out of the buffer.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The host serves the channel, not a plugin, so clients dispatch to it | Softov, 2026-11-15 | 01 |
| The channel is `x-ahpd-document:<file URI>`, one per file | Softov, 2026-11-15 | 01 |
| A change is a list of `{ from, to, insert }`, every position on the text of one version, in order and not overlapping | Softov, 2026-11-15 | 02 |
| A person's carets are a list of `{ anchor, head }`, one per caret. An empty list is a person with no caret | Softov, 2026-11-15 | 02 |
| The host rebases a change made on an older version, and refuses one older than its log | Softov, 2026-11-15 | 02 |
| The agent takes part through the file only. A host tool for it is a later plan | Softov, 2026-11-15 | 03 |
| The host sends no colour. A client derives it from the person's name | Softov, 2026-11-15: "for user we already have something that pick color" | 01 |
| Only `file:` URIs are documents | `(defaulted: the other schemes have no watch to keep the text in step)` | 01 |
| A file that is not UTF-8 text, or is over 5,000,000 characters, is refused | `(defaulted: ahpw's file page stops at 5,000,000 characters)` | 01 |
| Subscribe and `selected` need `file:get`; `changed` needs `file:put` | `(defaulted: the grants a read and a write of the file need now)` | 01, 02 |
| A person's name is the principal's `id`; on a host with no users directory, the first four letters or digits of the client id and ` guest`, such as `ab12 guest` | `(defaulted: a principal has no other name, and two guests must differ)` | 01 |
| The log keeps the last 500 changes | `(defaulted: minutes of typing for one person)` | 02 |
| When two inserts are at the same place, the one the host took first goes first | `(defaulted: the rule a client needs to reach the same text)` | 02 |
| The host writes the file 2 s after the last change, and at least every 10 s while changes go on | `(defaulted: short enough that a stop loses little, long enough to batch typing)` | 03 |
| `x-ahpd-document/saved` tells every subscriber which version is on disk | `(defaulted: a client shows "Saved" from it)` | 03 |
| A write from disk carries `by` only when the host knows the writer, from a `resourceWrite` | `(defaulted: an agent's own tool writes the file directly, and the host cannot tell who did)` | 03 |
| The host writes every open document when it closes | `(defaulted: the last 2 s of edits are not lost on a clean stop)` | 03 |
| The document channel is kept out of the replay buffer, and a reconnect lists it in `missing` | `(defaulted: the snapshot holds the whole state, and AHP's `missing` makes the client subscribe again)` | 01 |

## Proposed architecture

- **Data flow** - the first subscribe reads the file through `options.resources` into a document. The document holds `text`, `version` 0, the version last written, an empty log and the people. A change moves the text, the version and the log. A timer writes the text back through the same port.
- **Event flow** - every action goes out through `emit` with no replay. A client's own action comes back with its `origin`, after a rebase if the host moved it.
- **State flow** - one document per file URI, made at the first subscribe and dropped after the last person leaves and the text is written. The file is the only copy that outlives the host.
- **Layer responsibilities** - `packages/sdk/src/host/textchanges.ts`: apply a change, map a position, map a change through a change, all pure. `packages/sdk/src/host/documents.ts`: the documents, their timers and watches, and the actions. `gate.ts`, `actions.ts`, `snapshots.ts`, `handshake.ts`, `host.ts`: the wiring each existing channel already has.
- **Source-of-truth files** - [`code://packages/sdk/src/host/documents.ts`](../../../../packages/sdk/src/host/documents.ts) for the channel's state and rules.

### The channel

| State field | What it is |
| --- | --- |
| `resource` | The file URI |
| `text` | The text the host holds |
| `version` | How many changes the host has taken since it read the file |
| `saved` | The version last written to the file |
| `people` | One entry per subscribed client: `client`, `name`, `agent`, `ranges` |

| Action | Sent by | What it carries |
| --- | --- | --- |
| `x-ahpd-document/joined` | The host, at a subscribe | `client`, `name`, `agent` |
| `x-ahpd-document/left` | The host, at an unsubscribe or a disconnect | `client` |
| `x-ahpd-document/selected` | A client | `version`, `ranges` |
| `x-ahpd-document/changed` | A client, or the host for a write from disk | `version`, `changes`, `ranges`, and `by` from the host when it knows the writer |
| `x-ahpd-document/saved` | The host, after a write | `version` |

In a client's action, `version` is the version it counted on.
In the host's action, `version` is the version the positions are in now; after a `changed`, the host is at `version + 1`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The document channel](task-01-the-document-channel.md) | implemented | - |
| [02 - Changes and carets](task-02-changes-and-carets.md) | implemented | 01 |
| [03 - The file on disk](task-03-the-file-on-disk.md) | implemented | 02 |
| [04 - The documents page](task-04-the-documents-page.md) | implemented | 03 |

## Risks and tradeoffs

- Two inserts at one place need one order on the host and the client - the rule is in *Answers*, and task 02 tests it.
- A change refused as too old makes the client compare texts and send again - only a long disconnect passes 500 changes.
- An agent's write is a change on the version last written, so it does not undo edits the host holds - task 03 tests it.
- The host copies its string on each change - fast for files up to the 5,000,000-character limit; a rope replaces it if that limit grows.
- A document is one host's; two hosts never share one - nothing in this plan needs it.

## Resume state

- **Done so far:** tasks 01 to 04 built on 2026-11-15, on branch `host/20261115-0829-a-file-is-a-shared-document`; waiting for Softov's test.
- **Next action:** Softov runs the daemon from the branch with ahpw's plan; then review, `implemented.md`, and a PR.
- **Open questions:** none.
- **Watch out for:** `emit` keeps every action for replay unless told not to. The tie rule in task 02 is what ahpw's client must match.

## Final verification checklist

- [ ] Two clients subscribe to one file and each sees the other join.
- [ ] Two changes made on the same version both land, in the order the host took them, and both clients reach the same text.
- [ ] A change older than the log comes back with `rejectionReason`.
- [ ] A write to the file from outside lands as one change and does not undo an edit the host has not written yet.
- [ ] The file on disk matches the document 2 s after the last change.
- [ ] A reconnect lists the document channel in `missing`.
- [ ] `pnpm test`, the conformance and wire suites, and the computer suite pass.
