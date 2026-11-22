---
title: VS Code's extensions, plugins and customizations, and what ahpd serves of them
date: 2026-11-22
refs:
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - the VS Code source read for this note
  - git://102bf32b2 - ahpd main when this note was written
  - "[code://packages/sdk/src/plugins/enablement.ts](../../packages/sdk/src/plugins/enablement.ts) - ahpd's on/off decisions per scope"
  - "[code://packages/sdk/src/host/actions.ts#L976-L1030](../../packages/sdk/src/host/actions.ts#L976-L1030) - `session/activeClientSet`, where a client's tools and plugins arrive"
  - "[briefs/agent-extensions-are-a-sessions-plugins.md](../briefs/agent-extensions-are-a-sessions-plugins.md) - the agent extensions brief"
  - "[briefs/artifact-integrations.md](../briefs/artifact-integrations.md) - the artifact integrations brief"
---

# VS Code's extensions, plugins and customizations

VS Code has two windows on one agent host. The VS Code window is the editor, with Chat on its side. The Agents window, which VS Code's source calls Sessions (`src/vs/sessions`), is a window built around agent sessions. Both reach the agent host through the same protocol client, and both open the same Customizations page.

Six things have similar names. Each one lives in a different place, and a different part turns it on or off.

| Thing | What it is | Where it lives | Who turns it on or off | What ahpd serves |
| --- | --- | --- | --- | --- |
| VS Code extension | A VS Code add-on from the Marketplace | VS Code, on your computer | You, per window | Nothing: the host never sees it |
| Agent plugin | A package of skills, agents, hooks, commands and MCP servers for the agent | Your computer or the session's folder | You, per session, folder or everywhere | Yes, as session customizations |
| Customization | One item the agent uses: a plugin, MCP server, skill, instruction, agent, hook or tool | The session's state on the host | You, per session, folder or everywhere | Yes |
| ahpd plugin | A package the daemon loads, such as `@ahpd/computer` | The daemon | The daemon's configuration | Its tools and agents show; the plugin itself does not |
| Agent extension | A program Copilot CLI starts beside a chat, which can add tools or canvases | Copilot's folders, or a plugin | You, per session or chat | Not yet: an open brief |
| Artifact integration | Live status, actions and automation on something a session recorded, such as a pull request | The host | A root setting, and consent per automation | Not yet: an open brief |

## VS Code extensions

A VS Code extension is an add-on you install in VS Code, such as C/C++, Python or GitLens. It runs in VS Code's own extension host on your computer. The agent host never sees it.

The Agents window lists the extensions installed in VS Code under Customizations, Extensions. VS Code says: "Enabling or disabling an extension here only affects the Agents window." The switch is per window. It is not per session, and VS Code keeps it.

The list has three groups:

- **AI Features** - extensions that add tools, MCP servers or skills but did not declare support for the Agents window. They are off by default.
- **Supported** - extensions that declared support for the Agents window. They are on by default.
- **Other Extensions** - the rest, off by default, because they might not work there.

An extension that adds views, debuggers, status bar items or walkthroughs has a warning, since the Agents window does not have those.

## Agent plugins

An agent plugin is a package that adds commands, skills, agents, hooks and MCP servers to the agent, in the [Open Plugins](https://open-plugins.com/) format. VS Code says: "Extend your AI agent with plugins that add commands, skills, agents, hooks, and MCP servers from reusable packages." It is not a VS Code extension.

- **User** plugins are on your computer, under `~/.vscode/agent-plugins`, installed from a marketplace such as `github/awesome-copilot`. The VS Code window's Extensions view lists them under "Agent Plugins - Installed".
- **Workspace** plugins belong to the session's folder. Not checked: where in the folder VS Code and ahpd look for them.

How a user plugin reaches the agent: the window sends it to the host in `session/activeClientSet`, in the session's `activeClient.customizations`. The host then lists it in the session's customizations, with the `clientId` of the window that sent it. A plugin on your computer therefore reaches only the sessions your window is in.

How to work with them: open Customizations, Plugins. Each row has a switch. Browse, or Add Customization, Add Plugin, installs one.

## Customizations

Customizations is the page that both windows open for one session, titled with the session's agent and host, such as "Customizations (Claude Code · ahpd)". Every item on it except Extensions comes from the host, from the session's state.

| Section | What it lists |
| --- | --- |
| Browse | Searches marketplaces and Copilot Connectors, and installs or connects. Add Customization makes a new agent, skill or instructions file, or adds an MCP server or a plugin. |
| Plugins | The agent plugins the session can load. |
| MCP Servers | The session's MCP servers, from its plugins and its configuration. |
| Skills | The skills the agent can use. |
| Instructions | The instruction files the agent reads, such as `CLAUDE.md`. |
| Agents | The subagents the session's agent can start. |
| Hooks | The hooks that run on the agent's events. |
| Tools | The tools the agent can call. |
| Extensions | The VS Code extensions for the Agents window, as *VS Code extensions* says. Not from the host. |

A switch on a host item is a decision at one scope: global, folder or session. The most specific decision wins: the session's, then the folder's, then the global one. An item nobody decided about is on. ahpd keeps the global and folder decisions across sessions in `enablement.ts`, and the session's own in the session.

## ahpd plugins

An ahpd plugin is a package the daemon loads at start, such as `@ahpd/computer`, `@ahpd/push` or an agent backend. It adds to the daemon: tools, agents, channels, commands and settings. The daemon's configuration decides which ones load.

VS Code has no page for ahpd plugins. What they add shows where it belongs: a tool on the Tools page, an agent in the agent picker. An ahpd plugin is not an agent plugin, although both are called plugins.

## Agent extensions

An agent extension is a program that Copilot CLI starts for a session. It comes from your folder, the project, or an agent plugin. It can give the agent tools and canvases, and the agent can write one and reload it.

- VS Code reads them with `vscode/listAgentExtensions`, and turns one on or off with `vscode/setAgentExtensionEnabled`, for a session or a chat.
- VS Code draws them on the Customizations page, in the Canvases section, as canvas extensions. A row can open its plugin's details.
- Only Copilot serves them. Claude and Codex answer that the list is unavailable.

ahpd serves neither method. The brief [agent-extensions-are-a-sessions-plugins.md](../briefs/agent-extensions-are-a-sessions-plugins.md) asks what one row is in ahpd, and that question is open.

## Artifact integrations

A session records artifacts, such as a pull request it opened. An artifact integration adds live state to one, plus actions and automation. The built-in one is GitHub pull requests: checks, review threads, Fix CI, Address Reviews, Resolve Conflicts, Mark Ready and Merge. An automatic repair or merge needs consent.

- VS Code turns them on with the setting `chat.artifactIntegrations.enabled`: on by default in Insiders, off in Stable.
- Agents use them through four tools: `get_artifact_status`, `run_artifact_action`, `set_artifact_automation` and `disable_artifact_automation`.
- A window can offer its own integrations through `vscode/clientArtifactIntegrations/register`.

ahpd mirrors the root setting `artifactIntegrations`, and nothing reads it yet. Its own Agent Merge does part of the same job on a pull request. The brief [artifact-integrations.md](../briefs/artifact-integrations.md) holds the answers so far. Agent Merge does not run while integrations are on. The GitHub integration is new code built to VS Code's model.
