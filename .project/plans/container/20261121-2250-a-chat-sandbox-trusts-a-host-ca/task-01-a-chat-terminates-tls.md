---
title: A chat's sandbox terminates TLS with a host CA
status: todo
depends: []
layer: "sdk, computer"
refs:
  - https://github.com/anthropics/sandbox-runtime/blob/v0.0.83/README.md#tls-termination - the settings
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `node/protocolServerHandler.ts#L4354-L4382`
---

## Objective

`vscode/installSandboxCertificate`, `vscode/rotateSandboxCertificate` and `vscode/removeSandboxCertificate` turn a chat's TLS termination on, replace its CA, and turn it off.

## Files

- `CREATE: packages/computer/src/sandboxca.ts` - the CA by scope, made with `generateCa`, kept owner-only.
- `UPDATE: packages/computer/src/sandbox.ts` - `network.tlsTerminate` in the chat's settings while it is on, and the key in `denyRead`.
- `UPDATE: packages/sdk/src/types/sandbox.ts` - the certificate operations on the sandbox port.
- `UPDATE: packages/sdk/src/host/vscodemethods.ts` - the three methods and their checks.
- `UPDATE: packages/sdk/src/host/handshake.ts` - the capabilities, on a direct connection only.
- `UPDATE: packages/sdk/src/host/gate.ts` - `session:configure` for the four methods.
- `UPDATE: packages/sdk/test/users-gate-tables.test.ts` - the method count.
- `CREATE: packages/computer/test/sandboxca.test.ts` - the CA and the settings.

## Steps

1. Refuse a chat that is not a URI, a blank `scopeId`, and a chat that no longer runs.
2. Make the scope's CA once with `generateCa`, and write it owner-only.
3. On install, add `tlsTerminate` with the CA's paths to the settings of the chat's next commands, over any in `advanced.runtime`.
4. On rotate, make a new CA, and restart a long-lived sandboxed server of the scope's chats.
5. On remove, drop `tlsTerminate` from the chat's settings, and keep the CA.
6. Put the CA's key in every sandbox's `denyRead`.
7. Advertise the capabilities to a direct connection only.

## Validation

- `packages/computer/test/sandboxca.test.ts` - install, rotate and remove, and the key denied.
- The sdk and computer vitest suites pass, one at a time.

## Resume
