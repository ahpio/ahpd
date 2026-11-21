---
title: Plugins are a session's extensions
created: 2026-11-21
refs:
  - git://8a5a86a5c - main when the facts were checked
  - "[briefs/plugin-runtimes-external.md](plugin-runtimes-external.md) - a plugin that runs outside the daemon's process, which this brief builds on"
  - "[briefs/an-agent-makes-a-canvas.md](an-agent-makes-a-canvas.md) - canvases an agent makes"
  - "[briefs/a-person-acts-from-a-plugin-page.md](a-person-acts-from-a-plugin-page.md) - a plugin's page and its actions"
  - "[briefs/agent-extensions-are-a-sessions-plugins.md](agent-extensions-are-a-sessions-plugins.md) - the VS Code methods that list these plugins"
  - "[code://packages/sdk/src/plugins/views.ts](../../packages/sdk/src/plugins/views.ts) - plugin views as schema data models"
  - "[code://packages/sdk/src/plugins/enablement.ts](../../packages/sdk/src/plugins/enablement.ts) - on and off by scope"
  - "[code://packages/sdk/src/types/plugin.ts#L1319](../../packages/sdk/src/types/plugin.ts#L1319) - `registerTool`"
  - file:///github/ahpd/.scratch/dsh-todo-app - the dsh plugin Softov pointed at, a todo page in dsh's sidebar
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `node/copilot/copilotExtensionTools.ts`, `extensions_reload`; `common/agent.ts#L368-L396`, an extension's source and status
---

# Plugins are a session's extensions

Softov wants an ahpd plugin to work as VS Code's agent extensions do, and as dsh's plugins do. An agent can write one with a skill, and the plugin lasts beyond the session that made it. It can run as a stdio process instead of inside the daemon. It contributes UI as a schema, with no React or HTML: a view, a shortcut, an explorer, an activity item. Each client decides how to draw it. A plugin can also register a resource, such as a channel, and store its data through functions the host gives it. In his words: "I think for this one we need a separated brief since it can affect things."

## What others do

- **dsh** loads a plugin as a package with a host half and a client half. In `dsh-todo-app`, the host half is `export function apply() {}`. The client half registers a sidebar row and a main panel through `ctx.slots.inject` and `ctx.slots.register`, written in React, with its data in the browser's storage. Softov does not want the client injection for now.
- **VS Code** runs Copilot's agent extensions per session, from the user's folder, the project or a plugin. They add tools and canvases, and the agent reloads them with `extensions_reload` after it writes one.

## What ahpd has today

- A plugin runs inside the daemon's process. Running one outside it is [plugin-runtimes-external.md](plugin-runtimes-external.md).
- A plugin registers host tools with `registerTool`.
- A plugin shows views as schema data models, with `showView`, `setViewData` and `clearView` ([`code://packages/sdk/src/plugins/views.ts`](../../packages/sdk/src/plugins/views.ts)).
- A plugin is on or off by global, folder and session scope. It is not loaded for one session only.
- No skill teaches an agent to write a plugin, and no tool reloads one.

## Who writes

- `packages/sdk/src/plugins/` and `packages/sdk/src/types/plugin.ts`: no open plan or branch changes them now. The three briefs in the refs touch the same ground and are to be read together with this one.

## The change

- A plugin an agent makes in one session lasts after that session ends, and other sessions can change it. Softov, 2026-11-21: "a app made in one session must survive like forever or be changed by others sessions."
- A plugin can run as a stdio process, when its runtime allows it.
- A plugin contributes UI as a schema: views, shortcuts, an explorer, activity items. A client draws each kind its own way.
- A plugin can register a resource, such as a channel, and keep its data through host storage functions.
- A skill teaches an agent to write a plugin, and the agent can reload one it wrote.
- A client lists and toggles a session's plugins through VS Code's agent extension methods.

## Open points

- Not asked yet: the stdio protocol, the schema of each UI kind, and the storage functions' shape and scope.
- Not asked yet: where a plugin an agent made is kept, who may change it, and how it is removed.
- Softov said on 2026-11-21 that this brief is not yet what he wants for plugins. He reviews it later.
- Each is to be asked before this brief is final.
