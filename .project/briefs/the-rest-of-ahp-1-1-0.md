---
title: The rest of AHP 1.1.0
created: 2026-11-21
refs:
  - git://88251f665 - the commit of ahpd the facts were checked at
  - git://github.com/microsoft/agent-host-protocol@v1.1.0 - the 1.1.0 types and `CHANGELOG.md`, published on npm on 2026-11-13
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - VS Code main on 2026-11-21
  - "[code://packages/sdk/src/host/sessionmethods.ts#L1531-L1538](../../packages/sdk/src/host/sessionmethods.ts#L1531-L1538) - `createChat` refuses a chat with its own agent, as `multipleChatProviders` is not advertised"
  - "[code://packages/sdk/src/host/sessionmethods.ts#L1539-L1545](../../packages/sdk/src/host/sessionmethods.ts#L1539-L1545) - a first message must be a person's"
  - "[code://packages/sdk/src/host/sessionmethods.ts#L76](../../packages/sdk/src/host/sessionmethods.ts#L76) - `createChatMover`, which dispatches no `chat/moved`"
  - "[code://packages/sdk/src/host/resourcemethods.ts#L84-L92](../../packages/sdk/src/host/resourcemethods.ts#L84-L92) - `resourceRead`, which reads the whole resource"
  - "[code://UPSTREAM.md#L11-L17](../../UPSTREAM.md#L11-L17) - Pass 8, which lists most of these items"
  - "[plans/host/117-ahpd-speaks-ahp-1-1-0/plan.md](../plans/host/117-ahpd-speaks-ahp-1-1-0/plan.md) - the package, the types, steering, vendor, the canvas `uri` and the annotations channel"
---

# The rest of AHP 1.1.0

ahpd speaks all of AHP 1.1.0 that VS Code uses, so a 1.1.0 client meets the same host it meets in VS Code. Plan host/117 moves ahpd to the 1.1.0 package and its renames. This brief holds the other 1.1.0 additions, each to become a plan of its own when Softov asks.

## What others do

VS Code's agent host is the reference, at main `ddbdd50a9ed1`. UPSTREAM.md Pass 8 reads it for the items it lists, and names the upstream commits.

## What ahpd has today

Each line says what 1.1.0 adds, then what ahpd does at `88251f665`.

- **Chats with their own agent.** 1.1.0 adds `InitializeResult.multipleChatProviders` and `CreateChatParams.provider`. It also adds `provider` on `ChatState`, `ChatSummary` and `SessionChatSummary`. ahpd advertises none, and `createChat` refuses a `provider` in VS Code's words ([`code://packages/sdk/src/host/sessionmethods.ts#L1531-L1538`](../../packages/sdk/src/host/sessionmethods.ts#L1531-L1538)).
- **`chat/moved`.** 1.1.0 dispatches it on a moved chat's channel after a move to another session. It carries the new session, `provider` and `config.schema`. ahpd moves chats in `createChatMover` and dispatches no `chat/moved` ([`code://packages/sdk/src/host/sessionmethods.ts#L76`](../../packages/sdk/src/host/sessionmethods.ts#L76)).
- **Reasoning timing.** 1.1.0 adds `startedAt` and `duration` on a reasoning part and on `chat/reasoning`. agent-acp, agent-cofold and agent-claude send `chat/reasoning`. Whether any of them sends the timing is not checked.
- **Changeset `status` and nonces.** 1.1.0 adds `ChangesetFile.status` with the `Editing` flag, and nonces on a changeset file and an operation target. No ahpd changeset code names a nonce.
- **`ToolCallResult.resultMetadata`.** 1.1.0 carries MCP `CallToolResult._meta` apart from the host's metadata. No ahpd code names it.
- **Ranged `resourceRead`.** 1.1.0 adds `position` and `length` to the request and `size` to the result. `resourceRead` reads the whole resource ([`code://packages/sdk/src/host/resourcemethods.ts#L84-L92`](../../packages/sdk/src/host/resourcemethods.ts#L84-L92)).
- **`InitializeResult.environment.pathStyle`.** 1.1.0 lets a host say its path style. ahpd does not send it.
- **The `EmptyState` snapshot.** 1.1.0 allows `{}` as a snapshot's state for a channel with no fields, such as telemetry. ahpd names no `EmptyState`.
- **`McpServerCustomization.children`.** 1.1.0 adds MCP-served skills, which `session/customizationToggled` switches by id. agent-claude already sends customizations with `children` for its own kinds. Whether it covers MCP-served skills is not checked.
- **`authenticate.accountId`.** 1.1.0 adds a client's account hint. ahpd does not read it. `authenticate.target` is built, in `host/20261030-1608`.
- **Client messages of any origin.** 1.1.0 removes the rule that a client's message in `chat/turnStarted` and `chat/pendingMessageSet` is a person's. `createChat` still refuses a first message that is not a person's ([`code://packages/sdk/src/host/sessionmethods.ts#L1539-L1545`](../../packages/sdk/src/host/sessionmethods.ts#L1539-L1545)).
- **Unknown members on automation patches.** 1.1.0 keeps them in its generated clients. How ahpd's automation code treats an unknown member is not checked.
- **Windowed delivery and the TCP channel.** Both are experimental in 1.1.0, and VS Code's window uses neither. They stay out, as host/117 says.

## Who writes

- **ahpd main.** Plan host/117 changes the sdk files these items touch, so each plan from this brief starts after host/117 is built.
- **MayCXC's fork.** No fork branch newer than 2026-11-02 is waiting to merge, so none touches these items.

## The change

- ahpd advertises `multipleChatProviders` and lets a chat run on its own agent, with its own `config.schema`.
- A move of a chat to another session dispatches `chat/moved`.
- Each agent that streams reasoning sends its `startedAt` and `duration`.
- A changeset file says `status`, and a nonce that does not match fails the operation.
- A tool result keeps the MCP `_meta` as `resultMetadata`.
- `resourceRead` honours `position` and `length`, and answers `size`.
- The handshake says `environment.pathStyle`.
- A channel with no state fields can answer `{}`.
- MCP-served skills show as `children`, and a toggle switches them.
- A client's message may carry any origin that 1.1.0 allows.

## Open points

- Which items come first. Chats with their own agent is the largest, and `chat/moved` needs it for its `provider`.
- `authenticate.accountId` and unknown automation members: whether either asks for any change in ahpd.
- The four "not checked" facts in *What ahpd has today*, each checked before its plan is written.
