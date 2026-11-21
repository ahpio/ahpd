---
title: A running tool call moves to the background
created: 2026-11-21
refs:
  - git://fd7084712 - the commit of this repository the facts were checked at
  - npm://@anthropic-ai/claude-agent-sdk@0.3.325 - `Query.backgroundTasks(toolUseId?)` in `sdk.d.ts`, the Ctrl+B of the terminal for one call
  - npm://@microsoft/agent-host-protocol@1.0.0 - `BackgroundWork`, `chat/backgroundWorkSet`, `ToolCallActionBase._meta`, and the reducer of `chat/toolCallContentChanged`
  - npm://@agentclientprotocol/sdk@1.8.0 - ACP has `session/cancel` for a whole turn and no request for one call
  - npm://@earendil-works/pi-coding-agent@1.5.2 - pi's own `bash` tool, `dist/core/tools/bash.js`, has no background mode
  - npm://@cofold/tools@0.4.1 - cofold's own `shell_exec`, `dist/shell.js`, has no background mode
  - "[code://packages/sdk/src/host/background.ts#L15-L23](../../packages/sdk/src/host/background.ts#L15-L23) - `STOP_FLAG`, the `_meta` key that tells a client a row can be stopped"
  - "[code://packages/sdk/src/host/background.ts#L54-L76](../../packages/sdk/src/host/background.ts#L54-L76) - `rowOf`, the one builder of every background row"
  - "[code://packages/sdk/src/host/background.ts#L141-L145](../../packages/sdk/src/host/background.ts#L141-L145) - `stop`, which calls the `stop` the reporter gave"
  - "[code://packages/sdk/src/types/background.ts#L22-L45](../../packages/sdk/src/types/background.ts#L22-L45) - `BackgroundTask`, what a backend or a host tool reports"
  - "[code://packages/sdk/src/types/background.ts#L66-L73](../../packages/sdk/src/types/background.ts#L66-L73) - `ChatBackgroundTasks`, the seam a host tool reports its row through"
  - "[code://packages/sdk/src/host/vscodemethods.ts#L508-L517](../../packages/sdk/src/host/vscodemethods.ts#L508-L517) - `vscode/stopBackgroundWork`, the extension method the new method copies"
  - "[code://packages/sdk/src/host/chatactions.ts#L2170-L2178](../../packages/sdk/src/host/chatactions.ts#L2170-L2178) - `session/mcpServerBackgroundRequested`, the one background request AHP has, for an MCP server's startup"
  - "[code://packages/sdk/src/types/session.ts#L917](../../packages/sdk/src/types/session.ts#L917) - `backgroundMcpServerStartup`, an optional method on the session seam, the shape a new one copies"
  - "[code://packages/agent-claude/src/session/query.ts#L1215-L1248](../../packages/agent-claude/src/session/query.ts#L1215-L1248) - the Claude backend reads `task_started`, `task_updated` and `background_tasks_changed`"
  - "[code://packages/agent-claude/src/session/workers.ts#L400-L420](../../packages/agent-claude/src/session/workers.ts#L400-L420) - `stopOf`, a row's stop as the SDK's `stopTask`"
  - "[code://packages/sdk/src/tools/shell.ts#L228-L234](../../packages/sdk/src/tools/shell.ts#L228-L234) - the host shell tool's `mode`: `async` starts a command in the background"
  - "[code://packages/sdk/src/tools/shell.ts#L294-L341](../../packages/sdk/src/tools/shell.ts#L294-L341) - `async` sets a row and wakes the chat; a `sync` command let go by a client is only held"
  - "[code://packages/sdk/src/tools/shell.ts#L68-L70](../../packages/sdk/src/tools/shell.ts#L68-L70) - the answer the model gets when a client lets a command go on in the background"
  - "[code://packages/sdk/src/machines/shellcommand.ts#L159-L164](../../packages/sdk/src/machines/shellcommand.ts#L159-L164) - `narrowed`: a terminal claim that names the session and no tool call ends the call as `background`"
  - "[code://packages/sdk/src/host/shellcommand.ts#L320-L327](../../packages/sdk/src/host/shellcommand.ts#L320-L327) - the same claim on the host's own terminals"
  - "[code://packages/sdk/src/host/shells.ts#L349-L390](../../packages/sdk/src/host/shells.ts#L349-L390) - `start`: an async command wakes its chat with its end"
  - "[code://packages/sdk/src/host/shells.ts#L400-L420](../../packages/sdk/src/host/shells.ts#L400-L420) - `hold`: a let-go command keeps its shell busy, with no row and no wake"
  - "[code://packages/sdk/src/host/tooling.ts#L552-L555](../../packages/sdk/src/host/tooling.ts#L552-L555) - `shellToolsFor`: the host shell tool is offered only when `enableCustomTerminalTool` is on, and never on Windows"
  - "[code://packages/agent-pi/src/tools.ts#L18-L30](../../packages/agent-pi/src/tools.ts#L18-L30) - a host tool named `bash` replaces pi's own `bash`"
  - "[code://packages/agent-pi/src/tools.ts#L108-L130](../../packages/agent-pi/src/tools.ts#L108-L130) - pi runs a host tool's `run` and waits for its answer"
  - "[code://packages/agent-cofold/src/tools.ts#L36](../../packages/agent-cofold/src/tools.ts#L36) - `shell_exec` is cofold's own shell tool"
  - "[code://packages/agent-cofold/src/tools.ts#L173-L197](../../packages/agent-cofold/src/tools.ts#L173-L197) - cofold runs a host tool's `run` and waits for its answer"
  - "[code://packages/agent-acp/src/session/handlers.ts#L166-L180](../../packages/agent-acp/src/session/handlers.ts#L166-L180) - the ACP backend lists an agent's running terminals as rows"
  - https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/agentHost/node/shared/shellCommandExecution.ts#L185-L209 - VS Code's shell execution, which ends a call when the terminal claim is narrowed
  - https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/agentHost/node/protocolServerHandler.ts#L3432-L3444 - VS Code's `stopBackgroundWork`, the reference for a method on one background row
---

# A running tool call moves to the background

A person can move a tool call that is running to the background, as Claude Code's "Run in background" does.
The call answers at once and the work goes on.
The chat lists the work with its other background work, and the end of the work wakes the chat.
A tool says that it can do this.
A running call says it in its `_meta`, so a client knows when to offer the action.
Later, an agent in another session can call the same action.
The shell is the first tool: on Claude, on pi and on cofold.

## What others do

- **Claude Code** offers "Run in background" on a running Bash command or subagent, and Ctrl+B for all of them. The Agent SDK exposes it as `Query.backgroundTasks(toolUseId?)`. With an id, it moves the one call that tool_use started. The call answers "running in the background", the turn goes on, and a `task_notification` reports the end. It answers `false` when the id matches no foreground task. It throws when `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` is set.
- **VS Code's agent host** lets a person continue a host terminal command in the background. The client narrows the terminal's claim from the tool call to the session, and the call ends as `background`. VS Code has no action on a tool call itself, and no flag that says a call can move.
- **AHP 1.x** has no client action on a running tool call. Its one background request, `session/mcpServerBackgroundRequested`, is for an MCP server's startup. Stopping a row is VS Code's extension method `vscode/stopBackgroundWork`, with the flag `_meta['vscode.stopBackgroundWork']` on the row.
- **ACP** has `session/cancel`, which ends the whole turn. It has no request for one call.

## What ahpd has today

### Background rows

- One builder makes every row, [`rowOf`](../../packages/sdk/src/host/background.ts#L54-L76). A backend reports rows through `BackgroundTasks` on `Start`, and a host tool through `ChatBackgroundTasks`.
- A row whose task has a `stop` carries `STOP_FLAG`. `vscode/stopBackgroundWork` calls that `stop`.
- VS Code draws these rows as "Background shells", with a stop button.

### The flag on a tool call

- No tool call carries a flag that says it can move, or that it moved.
- `_meta` is on every tool call action, through `ToolCallActionBase`.
- The reducer replaces a running call's `_meta` on `chat/toolCallContentChanged`. A host can set or clear a flag while the call runs, but must send the other keys again.

### Claude

- The SDK can move one call, through `backgroundTasks(toolUseId)`. ahpd never calls it.
- The backend already handles the move. `task_updated` with `is_backgrounded` marks a subagent as background, and `background_tasks_changed` makes the rows ([`query.ts`](../../packages/agent-claude/src/session/query.ts#L1215-L1248)).
- The backend already stops a row through the SDK's `stopTask` ([`stopOf`](../../packages/agent-claude/src/session/workers.ts#L400-L420)).

### The host shell tool

- The model can start a command in the background with `mode: 'async'`. That sets a row with a stop, and the end of the command wakes the chat ([`shells.ts`](../../packages/sdk/src/host/shells.ts#L349-L390)).
- A client can let a `sync` command go on, by narrowing the terminal claim. The call answers that the user chose the background. The shell is then only held ([`hold`](../../packages/sdk/src/host/shells.ts#L400-L420)): no row, no stop, and no wake.
- The tool is offered only when the root config sets `enableCustomTerminalTool`, and never on Windows ([`shellToolsFor`](../../packages/sdk/src/host/tooling.ts#L552-L555)).

### pi

- pi runs in ahpd's process.
- pi's own `bash` has no background mode.
- A host tool named `bash` replaces pi's `bash`. With `enableCustomTerminalTool` on, pi runs the host shell tool.

### cofold

- `shell_exec` comes from `@cofold/tools@0.4.1` and has no background mode.
- The host shell tool is named `bash`, so it does not replace `shell_exec`. With `enableCustomTerminalTool` on, cofold has both.

### ACP

- ACP cannot move a call.
- The backend already lists an ACP agent's running terminals as rows ([`handlers.ts`](../../packages/agent-acp/src/session/handlers.ts#L166-L180)).

## Who writes

- `fork/host-124-shell-integration` changes the shell tool, `shells.ts`, `query.ts` and both backends' `tools.ts`. It is 3169 commits behind `main` and last moved on 2026-10-27. The change does not wait for it.
- `host/20261101-0329-maycxc-union` changes `types/session.ts`, `chatactions.ts` and cofold's `session.ts`. It is 2535 commits behind `main` and last moved on 2026-11-01. The change does not wait for it.
- No worktree that is open now changes these files.
- The brief [`the-terminal-tool-runs-on-windows-when-set.md`](the-terminal-tool-runs-on-windows-when-set.md) changes when the host shell tool is offered. When it is built, the host shell tool's background also works on Windows.
- `@cofold/tools` is our own package, in the cofold repository. A change to `shell_exec` goes there first.

## The change

### The concept

- A tool that can move to the background says so. A host tool says it on its definition. A backend says it for each call it runs.
- While such a call runs, its `_meta` says that it can move. After the move, its `_meta` says that it runs in the background.
- One ahpd extension method moves a call, by chat and tool call id. It answers whether the call moved.
- The one who runs the call moves it. That is the backend, for a tool the agent runs, and the host, for a host tool.
- A moved call answers its model at once. Its work becomes a row in the chat's background work, with a stop. Its end wakes the chat.
- A call with no flag cannot move. A client that does not read the flag offers nothing. Both still see the rows.

### The flag

Two keys in a call's `_meta`, named for what acts on them, as `vscode.stopBackgroundWork` names its method:

| Key | Value | On the call |
|---|---|---|
| `ahpd.backgroundToolCall` | `true` | While it runs and can move. It leaves the call when the call completes, so a finished call offers nothing. |
| `ahpd.backgroundWork` | the id of its row | Once its work runs in the background. It stays on the completed call. |

- Two keys, because the two facts live for different times. A moved call completes at once, and only the second key outlives that.
- `ahpd.backgroundWork` names the row, so a client can go from the call to its row and stop it there.
- A call the model started in the background carries `ahpd.backgroundWork` too, such as the host shell tool's `mode: 'async'`.
- `chat/toolCallComplete` carries the call's last `_meta`: without `ahpd.backgroundToolCall`, and with `ahpd.backgroundWork` when the work moved. The reducer replaces `_meta` with the one a completion carries, and keeps the old one when it carries none (`tcBaseWithMeta`).
- `ahpd.backgroundToolCall` is set on `chat/toolCallStart` or `chat/toolCallReady` when the provider knows then. It is set on `chat/toolCallContentChanged` when the provider learns it later, as Claude does on `task_started`.

### The method

- `x-ahpd/backgroundToolCall` takes `{ chat, toolCallId }` and answers `{ backgrounded: boolean }`.
- It asks for `chat:send`, as `chat/pendingMessageSet` does ([`gate.ts`](../../packages/sdk/src/host/gate.ts#L171-L176)). The stop of the row it makes keeps `chat:cancel`.
- It copies `vscode/stopBackgroundWork`: the same checks on `chat`, and `false` for an unknown chat, an unknown call, and a call with nothing to move.
- The host sends it to the provider of the call: an optional method on the session seam, or the host tool's own handler.

### The providers

- **Claude:** the backend answers the method with `backgroundTasks(toolUseId)`. It sets the flag on a Bash or subagent call once `task_started` names it with `is_backgrounded: false`. The SDK sets that field for `local_bash` and `local_agent` tasks. Its rows and stops already exist.
- **The host shell tool:** the method lets a `sync` command go on, as the narrowed claim does now. Both ways now also set a row with a stop and wake the chat at the end, as `mode: 'async'` does.
- **pi and cofold:** the shell moves through the host shell tool, for both. pi's own `bash` and cofold's `shell_exec` stay as they are.
- The host shell tool is offered to pi and cofold by default. For Claude and ACP, `enableCustomTerminalTool` still decides, with its default off.
- cofold then has both `shell_exec` and `bash`. *Open points* holds whether `shell_exec` is hidden.
- **ACP:** nothing moves. The rows of running terminals stay as they are.

### The clients

- ahpw and ahpc read the flag and offer "Run in background" on a running call.
- VS Code does not offer the action. It shows a moved call as a row in "Background shells".

## Answers

| What | Source |
|---|---|
| pi and cofold move the shell through the host shell tool | "Host shell tool", 2026-11-21 |
| The host shell tool is on by default for pi and cofold | "On for pi and cofold", 2026-11-21 |
| The method moves one call, never all calls of a chat | "One call only", 2026-11-21 |
| The `_meta` keys are `ahpd.backgroundToolCall` and `ahpd.backgroundWork` | "yes", 2026-11-21, to the two names suggested |
| The method asks for `chat:send`, the grant of a steering message | "the same permission as steer? because we are not changing, we are letting it continue the turn without the tool real reply", 2026-11-21 |

## Open points

- Whether cofold's `shell_exec` is hidden when the host shell tool is on.
