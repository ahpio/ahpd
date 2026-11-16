---
title: The document channel
status: done
depends: []
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/snapshots.ts#L414-L446](../../../../packages/sdk/src/host/snapshots.ts#L414-L446) - the annotations snapshot this one sits beside"
  - "[code://packages/sdk/src/host/gate.ts#L266-L273](../../../../packages/sdk/src/host/gate.ts#L266-L273) - `channelRead`"
  - "[code://packages/sdk/src/host/gate.ts#L382-L392](../../../../packages/sdk/src/host/gate.ts#L382-L392) - `ACTION_HOMES`"
  - "[code://packages/sdk/src/host/handshake.ts#L697-L722](../../../../packages/sdk/src/host/handshake.ts#L697-L722) - the reconnect's `missing` list"
  - "[code://packages/sdk/src/host.ts#L834-L918](../../../../packages/sdk/src/host.ts#L834-L918) - `emit` and its replay buffer"
---

## Objective

A client subscribes to `x-ahpd-shared:<file URI>` and gets the file's text, its version and the people in it.
The other subscribers see it join and leave, and the channel's actions never enter the replay buffer.

## Files

- `CREATE: packages/sdk/src/host/documents.ts` - the documents by file URI, the snapshot, `joined` and `left`.
- `UPDATE: packages/sdk/src/host/snapshots.ts` - serve `x-ahpd-shared:` from `documents.ts`.
- `UPDATE: packages/sdk/src/host/channels.ts` - the scheme constant and the function that reads the file URI out of the channel URI.
- `UPDATE: packages/sdk/src/host/gate.ts` - `channelRead` answers `file:get` for the scheme; `ACTION_HOMES` gets the `x-ahpd-shared` family.
- `UPDATE: packages/sdk/src/host.ts` - `emit` takes an option that keeps an action out of the replay buffer; the documents are told of each unsubscribe and disconnect.
- `UPDATE: packages/sdk/src/host/handshake.ts` - a reconnect lists each document channel in `missing`.
- `UPDATE: packages/sdk/src/host/context.ts` - the documents on the host context.
- `CREATE: test/host-documents.test.ts` - the channel through the scenario client.

## Steps

1. Add `DOCUMENT_SCHEME = 'x-ahpd-shared'` and `documentFileOf(channel)` to `channels.ts`.
2. In `documents.ts`, keep a map from file URI to a document: `text`, `version`, `saved`, the people by client id.
3. At the first subscribe, read the file through `options.resources.read` as UTF-8.
4. Refuse a subscribe for a URI that is not `file:`, for text not in UTF-8, and for text over the limit.
5. Set the limit to 5,000,000 characters.
6. Answer the snapshot with `resource`, `text`, `version`, `saved` and `people`.
7. At each subscribe, add the person and emit `x-ahpd-shared/joined` with `client`, `name` and `agent`.
8. Take `name` from the principal's `id`, and use the client id's start and ` guest` when the host has no users directory.
9. At each unsubscribe and disconnect, remove the person and emit `x-ahpd-shared/left`.
10. Add a `replay: false` option to `emit`, and emit every document action with it.
11. Make `channelRead` answer `file:get` for the scheme, and add `x-ahpd-shared` to `ACTION_HOMES`.
12. In the reconnect, put each document channel in `missing`, so the client subscribes again.
13. Serve the scheme in `snapshots.ts` beside the annotations channel.

## Validation

- `test/host-documents.test.ts`: two clients subscribe to one file, and each sees the other's `joined` and `left`.
- The same file: the snapshot holds the file's text, version 0 and the people.
- The same file: the host refuses a subscribe without `file:get`, a binary file, and a file over the limit.
- The same file: a reconnect lists the document channel in `missing`, and no document action is in the replay.
- `pnpm test test/host-documents.test.ts` passes.

## Resume

Built on 2026-11-15.
- The tests are in `packages/sdk/test/documents.test.ts` and `packages/sdk/test/documents-gate.test.ts`, not `test/`: the sdk keeps its tests there.
- `emit` keeps a document's actions out of the replay buffer by the channel's scheme, with no new option. The host's own refusals on a document are kept out too.
- `spaceOf` answers `own` for `x-ahpd-shared:`, so the host does not take it for a plugin's channel.
- `agent` is always `false`: in this plan an agent takes part through the file only.
- After Softov's test on 2026-11-15: the module is `packages/sdk/src/host/shared.ts` and the docs page `docs/sdk/SHARED.md`. The state has `kind: 'text'`, each person a `kind` and `editing`, and a root connection is named `root` and the start of its client id.
