---
title: A chat's sandbox trusts a host CA
domain: container
status: planned
priority: medium
created: 2026-11-21
revalidated: 2026-11-21
requires:
  - plans/container/20261121-2250-the-sandbox-runtime-is-ahpios-fork/plan.md
refs:
  - git://8a5a86a5c - main when the plan was made
  - "[briefs/vscode-methods-ahpd-does-not-serve.md](../../../briefs/vscode-methods-ahpd-does-not-serve.md) - group *Sandbox certificates*"
  - "[code://packages/computer/src/sandbox.ts#L209-L214](../../../../packages/computer/src/sandbox.ts#L209-L214) - the settings a chat's sandbox runs with"
  - "[code://packages/sdk/src/host/sandbox.ts#L148-L173](../../../../packages/sdk/src/host/sandbox.ts#L148-L173) - `withChatSandboxState`, where a chat's sandbox `_meta` is written"
  - "[code://packages/sdk/src/types/sandbox.ts#L125](../../../../packages/sdk/src/types/sandbox.ts#L125) - `SessionSandboxState`, a session's sandbox as the host holds it"
  - "[code://packages/sdk/src/host/vscodemethods.ts](../../../../packages/sdk/src/host/vscodemethods.ts) - the `vscode/*` handlers"
  - https://github.com/anthropics/sandbox-runtime/blob/v0.0.83/README.md#tls-termination - `network.tlsTerminate`, its CA, and its limits
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `node/protocolServerHandler.ts#L4354-L4382`, the four methods; `common/meta/vscode/agentSandboxCertificate.ts`, the capabilities and the status in `_meta`; `node/copilot/copilotAgent.ts#L5827-L5850`, a refresh after each change
---

## Goal

A client turns on TLS termination for one chat's sandbox, with a CA the host keeps. Inside the sandbox, srt can then see and filter each HTTPS request. The client can rotate the CA, turn termination off, and recheck it, with VS Code's four sandbox certificate methods.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "SandboxCertificate|tlsTerminate|caCertPath" packages/` - nothing.
- 0.0.83's `index.d.ts` - exports `generateCa` and `validateCaPair`, and the settings take `network.tlsTerminate` with `caCertPath` and `caKeyPath`.

### Runtime path

```
vscode/installSandboxCertificate {chat, scopeId} -> the host CA, made once -> the chat's next command's settings get tlsTerminate
vscode/rotateSandboxCertificate -> a new CA -> every chat that uses it
vscode/removeSandboxCertificate -> the chat's tlsTerminate off, the CA kept
vscode/refreshSandboxCertificate -> the status read again -> session _meta['vscode.sandboxCertificate']
```

### Gaps

- ahpd's sandbox filters by domain only, with no CA and no termination.
- A session says nothing about a chat's certificate.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Plan sandbox certificates, on the fork | Softov, 2026-11-21, "Plan the runtime switch and the CA (Recommended)" | 01, 02 |
| Install turns TLS termination on for the chat, with a host CA; rotate replaces the CA; remove turns termination off and keeps the CA; refresh reports the state | Softov, 2026-11-21, "Turn on TLS termination for the chat (Recommended)" | 01, 02 |
| Termination is off until a client installs | Softov, 2026-11-21, the same answer | 01 |
| The CA and its key are made with srt's `generateCa`, and kept owner-only in the host's state folder | (defaulted: srt's API, VS Code keeps the key on remove) | 01 |
| `scopeId` names the CA; the chats of one runtime share it | (defaulted: VS Code's status doc) | 01 |
| Params are `{chat, scopeId}`; a chat that is not a URI, and a blank `scopeId`, are refused | (defaulted: VS Code L4363-L4379) | 01 |
| A chat that no longer runs is refused as `The chat is no longer running. Reopen it before changing sandbox certificate trust.` | (defaulted: VS Code `_withSandboxCertificateRefresh`) | 01 |
| The status is `{scopeId, state, canInstall, requiresRotation, detail?}` under `vscode.sandboxCertificate` `{version: 1, chats}` in the session's `_meta`, written beside the chat's sandbox state | (defaulted: VS Code `agentSandboxCertificate.ts`) | 02 |
| A chat that allows the whole network, or runs where srt's termination cannot (Bun before 1.4), says `unsupported`: with `network.enabled: false` no proxy starts | (defaulted: VS Code's five states) | 02 |
| The CA's `tlsTerminate` wins over one in `advanced.runtime` | (defaulted: the client's install is the later choice) | 01 |
| Every running chat's status is read again in a `finally`, after a failed change too | (defaulted: VS Code L5839-L5841) | 02 |
| `_meta` advertises the four capabilities only to a direct connection, not through a relay | (defaulted: VS Code L1262-L1269) | 01 |
| The four methods need `session:configure` | (defaulted: a chat's sandbox settings are its session's configuration) | 01 |

## Proposed architecture

- **Data flow** - the sdk's methods reach the computer plugin through the sandbox port. The plugin keeps the CA, and writes `tlsTerminate` into each settings file it makes for the chat's commands.
- **State flow** - the CA by scope; the chats with termination on; each chat's status in its session's `_meta`.
- **Layer responsibilities** - sdk: the methods, the grant and the status; computer: the CA and the settings.
- **Source-of-truth files** - `packages/computer/src/sandboxca.ts`, created here.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A chat's sandbox terminates TLS with a host CA](task-01-a-chat-terminates-tls.md) | todo | - |
| [02 - A chat's certificate status is in the session](task-02-a-chats-status-is-said.md) | todo | 01 |

## Risks and tradeoffs

- With termination on, srt decrypts every HTTPS request of the chat, and a client that pins certificates fails. It is off until a client asks, one chat at a time.
- The CA's key can mint a certificate any sandboxed program trusts. It stays owner-only, and outside every sandbox's read list.

## Resume state

- **Done so far:** nothing.
- **Next action:** wait for `container/20261121-2250-the-sandbox-runtime-is-ahpios-fork`, then [task-01-a-chat-terminates-tls.md](task-01-a-chat-terminates-tls.md).
- **Open questions:** none.
- **Watch out for:** srt's termination needs Node; it throws on Bun older than 1.4.

## Final verification checklist

- [ ] A test: install, then an HTTPS request from the sandbox is terminated, and the CA verifies.
- [ ] A test: rotate gives a new CA, and remove turns termination off with the CA kept.
- [ ] A test: the status in `_meta` after each change, for two chats of one scope.
- [ ] A test: the CA's key is outside the sandbox's read list.
- [ ] The gates pass: typecheck, boundary, and the sdk and computer suites, one at a time.
