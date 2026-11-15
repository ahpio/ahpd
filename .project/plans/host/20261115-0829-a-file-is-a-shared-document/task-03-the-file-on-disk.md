---
title: The file on disk
status: todo
depends: [task-02-changes-and-carets.md]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/types/resources.ts#L133-L256](../../../../packages/sdk/src/types/resources.ts#L133-L256) - `ResourceStore.write` and `watch`"
  - "[code://packages/sdk/src/host.ts#L2195-L2210](../../../../packages/sdk/src/host.ts#L2195-L2210) - the close steps"
---

## Objective

The host writes the document to its file, and a write to the file from outside lands in the document as one change.
A write from outside never undoes an edit the host holds and has not written yet.

## Files

- `UPDATE: packages/sdk/src/host/documents.ts` - the write timer, `saved`, the watch, a write from disk as a change, the drop after the last person leaves.
- `UPDATE: packages/sdk/src/host.ts` - a close step writes every open document.
- `UPDATE: test/host-documents.test.ts` - the file on disk through the scenario client.

## Steps

1. Write the text through `options.resources.write` 2 s after the last change.
2. While changes go on, write it at least every 10 s.
3. After each write, keep the text written and its version, and emit `x-ahpd-document/saved` with that version.
4. At the first subscribe, watch the file through `options.resources.watch`.
5. When the watch reports the file changed, read it.
6. Compare the new text with the text last written; cut the same start and the same end.
7. Make one change from what is left, on the version last written.
8. Rebase that change as task 02 does, apply it and emit it.
9. Set `by` on that change when the last `resourceWrite` to the file named its owner, and leave it out otherwise.
10. Treat the host's own write as no change; the comparison finds nothing.
11. After the last person leaves, write the text if it changed, close the watch, and drop the document.
12. Add a close step that writes every open document before the stores close.

## Validation

- `test/host-documents.test.ts`: the file holds the document's text 2 s after the last change, and `saved` names that version.
- The same file: a write to the file from outside arrives as one `changed`.
- The same file: a write from outside lands beside an edit not yet written, and keeps it.
- The same file: the host's own write sends no `changed`.
- The same file: after the last person leaves, the file holds the text and the document is gone.
- `pnpm test test/host-documents.test.ts` passes.

## Resume
