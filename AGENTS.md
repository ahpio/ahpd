# ahpd

A self-hosted, plugin-driven agent host built on the Agent Host Protocol (AHP), with an SDK to build your own host and plugins.

## Packages

Each folder in `packages/` is published to npm.

- `packages/sdk` - [`@ahpd/sdk`](https://www.npmjs.com/package/@ahpd/sdk), the library to build a host, which depends only on the protocol.
- `packages/server` - [`@ahpd/server`](https://www.npmjs.com/package/@ahpd/server), the `ahpd` daemon, which bundles no backend and loads each one as a plugin.
- `packages/agent-claude` - [`@ahpd/agent-claude`](https://www.npmjs.com/package/@ahpd/agent-claude), Claude Code through the Claude Agent SDK.
- `packages/agent-acp` - [`@ahpd/agent-acp`](https://www.npmjs.com/package/@ahpd/agent-acp), Codex, Copilot, Gemini and any other ACP agent.
- `packages/agent-pi` - [`@ahpd/agent-pi`](https://www.npmjs.com/package/@ahpd/agent-pi), the pi coding agent.
- `packages/agent-cofold` - [`@ahpd/agent-cofold`](https://www.npmjs.com/package/@ahpd/agent-cofold), a generic agent for OpenAI-compatible models.
- `packages/bot` - [`@ahpd/bot`](https://www.npmjs.com/package/@ahpd/bot), agents with a name, a persona and a workspace of their own.
- `packages/computer` - [`@ahpd/computer`](https://www.npmjs.com/package/@ahpd/computer), sessions in isolated machines: Docker containers, VMs or ssh boxes.
- `packages/tasks` - [`@ahpd/tasks`](https://www.npmjs.com/package/@ahpd/tasks), tasks and plans that agents coordinate through host tools.
- `packages/push` - [`@ahpd/push`](https://www.npmjs.com/package/@ahpd/push), phone and browser notifications when a session needs you.
- `packages/webhook` - [`@ahpd/webhook`](https://www.npmjs.com/package/@ahpd/webhook), external services that trigger bots and automations, each with its own secret.
- `packages/tunnel-devtunnel` - [`@ahpd/tunnel-devtunnel`](https://www.npmjs.com/package/@ahpd/tunnel-devtunnel), remote access through Microsoft Dev Tunnels.
- `packages/activepieces` - [`@ahpd/activepieces`](https://www.npmjs.com/package/@ahpd/activepieces), Activepieces pieces as connectors and their actions as tools.

## Other folders

- `examples/` - small hosts to run and read.
- `docs/` - the user docs site (VitePress).
- `tools/`, `scripts/` - checks, schema and dev helpers.

[DEVELOPER.md](DEVELOPER.md) has the setup, build and test commands.

## Related projects

- [ahpc](https://github.com/ahpio/ahpc) - a terminal client for AHP.
- [ahpw](https://github.com/ahpio/ahpw) - a web UI for an AHP server, as an ahpd plugin or on its own.
- [ahp-desk](https://github.com/ahpio/ahp-desk) - a desktop app for AHP hosts.

## .project

`.project/` is the project record of ideas, briefs, plans, tasks, decisions, problems, rules and pending checks, so read it before you change something and keep it current with the `do-spec` skill in `.agents/skills/`.
