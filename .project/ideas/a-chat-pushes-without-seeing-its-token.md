---
title: A chat pushes without seeing its token
created: 2026-11-22
refs:
  - "[code://packages/computer/src/sandbox.ts#L210-L222](../../packages/computer/src/sandbox.ts#L210-L222) - the settings a chat's sandbox runs with"
  - https://github.com/anthropics/sandbox-runtime/blob/v0.0.83/README.md#tls-termination - `network.tlsTerminate` and `credentials`, which add a credential to a request at the proxy
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `node/copilot/copilotSandboxCertificate.ts`, where VS Code's credential settings make the CA required
---

A sandboxed chat's agent runs `git push` or `gh`, and the sandbox's proxy adds the token to the request. The agent and its commands never hold the secret. The runtime can do this with `credentials` and TLS termination, but no ahpd setting turns either on. It would stop an agent from leaking or misusing a token it can read today.
It is the feature that makes [plans/container/20261121-2250-a-chat-sandbox-trusts-a-host-ca](../plans/container/20261121-2250-a-chat-sandbox-trusts-a-host-ca/plan.md) worth building.
