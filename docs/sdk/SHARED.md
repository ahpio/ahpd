# Shared resources

A **shared resource** is a resource that several clients have open at once. Each one sees who else is in it, who is editing, where their carets are, and every change as it lands. A shared resource has a `kind`, which says what its state and its changes are; `text`, a file's text, is the only kind today. The host holds the text while anyone has the file open, puts the edits in order, and writes the file.

| Term | |
| --- | --- |
| a shared resource | One resource, open in one or more clients, at `x-ahpd-shared:<resource URI>` |
| a kind | What the resource is, and so what its changes are: `text` today |
| a version | How many changes the host has taken since it read the file |
| a change | A list of `{ from, to, insert }`, every position a character offset on the text of one version |
| carets | A list of `{ anchor, head }`, one per caret; `anchor` is where a selection started, `head` is where the caret is |

## Open a shared resource

Subscribe to `x-ahpd-shared:` followed by the file's URI. The snapshot holds the text and the people already in it.

```json
{ "method": "subscribe", "params": { "channel": "x-ahpd-shared:file:///home/ana/project/PLAN.md" } }
```

```json
{ "snapshot": {
  "resource": "x-ahpd-shared:file:///home/ana/project/PLAN.md",
  "fromSeq": 310,
  "state": {
    "kind": "text",
    "resource": "file:///home/ana/project/PLAN.md",
    "text": "## Tasks\n- one\n",
    "version": 41,
    "saved": 41,
    "people": [{ "client": "c-rafael", "name": "rafael", "kind": "user", "editing": true, "ranges": [{ "anchor": 12, "head": 12 }] }]
  } } }
```

Only `file:` URIs open, and only text up to 5,000,000 characters. Opening needs `file:get`. To leave, unsubscribe or disconnect.

## Actions

| Action | Sent by | What it carries |
| --- | --- | --- |
| `x-ahpd-shared/joined` | The host, when a client subscribes | `client`, `name`, `kind`, `editing` |
| `x-ahpd-shared/left` | The host, when a client unsubscribes or disconnects | `client` |
| `x-ahpd-shared/editing` | A client, when it starts or stops editing | `editing` |
| `x-ahpd-shared/selected` | A client | `version`, `ranges` |
| `x-ahpd-shared/changed` | A client, or the host for a write to the file from outside | `version`, `changes`, `ranges`, and `by` when the host knows who wrote the file |
| `x-ahpd-shared/saved` | The host, after it writes the file | `version` |

A client sends `editing`, `selected` and `changed` with `dispatchAction`. `selected` needs `file:get`; `editing` and `changed` need `file:put`.

A person's `kind` is `user` for a signed-in person, named by their id; `root` for the host's own root connection, named `root` and the start of the client id; `guest` on a host with no users, named by the start of the client id and `guest`; and `agent` for an agent.

`version` in a client's action is the version it counted on. In the host's action, it is the version the positions are in now; after a `changed`, the resource is at `version + 1`. `ranges` in a `changed` are the sender's carets after the change.

## Two people typing at once

The host takes a change made on the current version as it is. A change made on an older version is moved past the changes taken since, and then applied, so nobody is refused for typing at the same time as someone else. When two inserts are at the same place, the one the host took first goes first.

Ana and Rafael both type on version 0. Ana's change arrives first:

```json
{ "type": "x-ahpd-shared/changed", "version": 0, "changes": [{ "from": 0, "to": 0, "insert": "# Plan\n" }] }
{ "type": "x-ahpd-shared/changed", "version": 0, "changes": [{ "from": 15, "to": 15, "insert": "- two\n" }] }
```

Everyone gets Ana's as she sent it, and Rafael's moved past her seven characters, on version 1:

```json
{ "type": "x-ahpd-shared/changed", "version": 1, "changes": [{ "from": 22, "to": 22, "insert": "- two\n" }] }
```

A client knows its own change by the `origin` on it. While one of its changes is on its way, it moves each change it receives past its own, and its own past each one, before it applies them. CodeMirror's `ChangeSet.map` does both.

The host keeps the last 500 changes. A change made on a version older than that comes back with `rejectionReason`, starting `stale:`. The client subscribes again and sends what differs from the new snapshot as one change.

## The file on disk

The host writes the text 2 s after the last change, and at least every 10 s while changes go on, then sends `saved`. A write to the file from outside, such as an agent's own tool, arrives as one `changed` with no `origin`. It is taken as a change on the version last written, so it never undoes an edit the host had not written yet. When the last person leaves, the host writes the file and lets the shared resource go.

## Reconnecting

A shared resource's actions are not kept for replay. A `reconnect` lists its channel in `missing`, and the client subscribes again.

## Comments

People comment on a resource and reply on its own channel, `x-ahpd-annotations:<resource URI>`, apart from the edits. The state, the actions and the reducer are AHP's annotations: `annotations/set`, `annotations/updated`, `annotations/removed`, `annotations/entrySet` and `annotations/entryRemoved`.

Reading the channel needs the resource's `get`, such as `file:get`. Each action on it needs the resource's `comment`, which the read group holds, so whoever may read a file may comment on it unless a role drops `comment`.

The host stamps each new entry with who wrote it and when, whatever the client put there:

```json
{ "type": "annotations/entrySet", "annotationId": "c1",
  "entry": { "id": "c1-2", "text": "The resource kind.",
    "_meta": { "ahpd": { "by": "user:rafael", "name": "rafael", "at": "2026-11-15T14:02:11Z" } } } }
```

A comment's `origin.session` is a session of the writer, or the channel itself for a comment made outside any session. While the resource is open as a shared resource, each comment's range moves with the edits. A comment whose words are deleted becomes a point where they were, with `_meta.ahpd.outdated` set, and its thread stays. The comments are kept between restarts.

