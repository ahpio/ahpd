---
title: A chat's certificate status is in the session
status: todo
depends: [task-01-a-chat-terminates-tls.md]
layer: "sdk, computer"
refs:
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `common/meta/vscode/agentSandboxCertificate.ts`, the status
---

## Objective

Each running chat's certificate status is in its session's `_meta`, read again after every change and on `vscode/refreshSandboxCertificate`.

## Files

- `UPDATE: packages/computer/src/sandboxca.ts` - a chat's status.
- `UPDATE: packages/sdk/src/host/vscodemethods.ts` - `vscode/refreshSandboxCertificate`.
- `UPDATE: packages/sdk/src/host/sandbox.ts` - `vscode.sandboxCertificate` in the session's `_meta`, beside `withChatSandboxState`.
- `UPDATE: packages/computer/test/sandboxca.test.ts` - the status after each change.

## Steps

1. Say `notRequired` for a chat with no sandbox, and `notInstalled` for one with termination off.
2. Say `unsupported` for a chat that allows the whole network, and where srt cannot terminate.
3. Say `installed` when the chat's CA and key pass `validateCaPair`, and `error` with `detail` when not.
4. Set `requiresRotation` when the CA is near its end, or fails the check.
5. Read every running chat's status again in a `finally` after install, rotate and remove.
6. Read the asked chat's status on `vscode/refreshSandboxCertificate`.
7. Put the statuses under `vscode.sandboxCertificate` `{version: 1, chats}`, and drop the key when no chat has one.

## Validation

- `packages/computer/test/sandboxca.test.ts` - each state, and two chats of one scope after a rotate.
- The sdk and computer vitest suites pass, one at a time.

## Resume
