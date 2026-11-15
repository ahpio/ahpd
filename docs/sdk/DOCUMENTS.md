# Shared documents

A **shared document** is a file that several clients have open at once. Each one sees who else is in it, where their carets are, and every edit as it lands. The host holds the text while anyone has the file open, puts the edits in order, and writes the file.

| Term | |
| --- | --- |
| a document | One file, open in one or more clients, at `x-ahpd-document:<file URI>` |
| a version | How many changes the host has taken since it read the file |
| a change | A list of `{ from, to, insert }`, every position a character offset on the text of one version |
| carets | A list of `{ anchor, head }`, one per caret; `anchor` is where a selection started, `head` is where the caret is |

## Open a document

Subscribe to `x-ahpd-document:` followed by the file's URI. The snapshot holds the text and the people already in it.

```json
{ "method": "subscribe", "params": { "channel": "x-ahpd-document:file:///home/ana/project/PLAN.md" } }
```

```json
{ "snapshot": {
  "resource": "x-ahpd-document:file:///home/ana/project/PLAN.md",
  "fromSeq": 310,
  "state": {
    "resource": "file:///home/ana/project/PLAN.md",
    "text": "## Tasks\n- one\n",
    "version": 41,
    "saved": 41,
    "people": [{ "client": "c-rafael", "name": "rafael", "agent": false, "ranges": [{ "anchor": 12, "head": 12 }] }]
  } } }
```

Only `file:` URIs open, and only text up to 5,000,000 characters. Opening needs `file:get`. To leave, unsubscribe or disconnect.

## Actions

| Action | Sent by | What it carries |
| --- | --- | --- |
| `x-ahpd-document/joined` | The host, when a client subscribes | `client`, `name`, `agent` |
| `x-ahpd-document/left` | The host, when a client unsubscribes or disconnects | `client` |
| `x-ahpd-document/selected` | A client | `version`, `ranges` |
| `x-ahpd-document/changed` | A client, or the host for a write to the file from outside | `version`, `changes`, `ranges`, and `by` when the host knows who wrote the file |
| `x-ahpd-document/saved` | The host, after it writes the file | `version` |

A client sends `selected` and `changed` with `dispatchAction`. `selected` needs `file:get`; `changed` needs `file:put`.

`version` in a client's action is the version it counted on. In the host's action, it is the version the positions are in now; after a `changed`, the document is at `version + 1`. `ranges` in a `changed` are the sender's carets after the change.

## Two people typing at once

The host takes a change made on the current version as it is. A change made on an older version is moved past the changes taken since, and then applied, so nobody is refused for typing at the same time as someone else. When two inserts are at the same place, the one the host took first goes first.

Ana and Rafael both type on version 0. Ana's change arrives first:

```json
{ "type": "x-ahpd-document/changed", "version": 0, "changes": [{ "from": 0, "to": 0, "insert": "# Plan\n" }] }
{ "type": "x-ahpd-document/changed", "version": 0, "changes": [{ "from": 15, "to": 15, "insert": "- two\n" }] }
```

Everyone gets Ana's as she sent it, and Rafael's moved past her seven characters, on version 1:

```json
{ "type": "x-ahpd-document/changed", "version": 1, "changes": [{ "from": 22, "to": 22, "insert": "- two\n" }] }
```

A client knows its own change by the `origin` on it. While one of its changes is on its way, it moves each change it receives past its own, and its own past each one, before it applies them. CodeMirror's `ChangeSet.map` does both.

The host keeps the last 500 changes. A change made on a version older than that comes back with `rejectionReason`, starting `stale:`. The client subscribes again and sends what differs from the new snapshot as one change.

## The file on disk

The host writes the text 2 s after the last change, and at least every 10 s while changes go on, then sends `saved`. A write to the file from outside, such as an agent's own tool, arrives as one `changed` with no `origin`. It is taken as a change on the version last written, so it never undoes an edit the host had not written yet. When the last person leaves, the host writes the file and lets the document go.

## Reconnecting

A document's actions are not kept for replay. A `reconnect` lists the document's channel in `missing`, and the client subscribes again.
