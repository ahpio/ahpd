---
title: A guide page for each subject
created: 2026-11-20
refs:
  - git://b7675f7da - the commit of ahpd the facts were checked at
  - "[code://docs/README.md](../../docs/README.md) - the index: three folders, one for each kind of reader"
  - "[code://docs/.vitepress/config.mts#L18-L116](../../docs/.vitepress/config.mts#L18-L116) - the sidebar, one group per folder, and the check that every page is in it"
  - "[code://docs/index.md](../../docs/index.md) - the home page, with one feature card per folder"
  - "[code://README.md](../../README.md) - the root README, whose capability titles link a page each, on #390"
  - https://diataxis.fr/explanation/ - Diátaxis, the split of docs into tutorials, how-to guides, reference and explanation
  - https://code.visualstudio.com/docs - VS Code's docs, a page per feature for its user, apart from the API reference
---

# A guide page for each subject

Softov wants a docs page for each thing ahpd does, written for a person who uses it.
Each page says what the thing is, why it is useful, how it works, and the commands and settings that drive it. The root README's capability titles link these pages. The pages land before 0.15.0.

## What others do

- Diátaxis splits docs into four kinds: tutorials, how-to guides, reference and explanation. An explanation page says what a thing is and why, and links the reference for the detail.
- VS Code's docs have a page per feature for its user, such as Source Control or Terminal. Each says what the feature does and how to use it, and the API reference is a separate site.

## What ahpd has today

- The docs are in three folders, one for each kind of reader. [`code://docs/README.md`](../../docs/README.md)
  `server/` is for running the daemon, `sdk/` for building a host, and `plugins/` for writing a plugin.
  `updates/` holds the release notes.
- No page is for a person who wants to know what ahpd does. A subject is spread across a server page, an sdk page and a plugin page. Spending, for one, is `server/USAGE.md`, `sdk/USAGE.md` and `sdk/POLICY.md`.
- The sidebar has one group per folder, in the order `docs/README.md` lists them. The build throws when a page is in no sidebar group. [`code://docs/.vitepress/config.mts`](../../docs/.vitepress/config.mts#L18-L116)
- The home page has one feature card per folder: Server, SDK and Plugins. [`code://docs/index.md`](../../docs/index.md)
- On #390, the root README's eleven capability titles link today's pages: `sdk/SESSIONS`, `server/CONNECT`, `server/PLUGINS`, `plugins/agent-claude`, `plugins/COMPUTERS`, `sdk/AUTOMATIONS`, `server/USERS`, `server/RUN#doctor`, `server/USAGE`, `server/GATEWAY` and `plugins/PLUGINS`. Several of them are written for a developer.

## Who writes

- #390 changes the root README and adds `docs/media/`. The guide changes the README's title links again, after #390 merges.
- #389 changes `docs/updates/v0_15.md` only.
- No other branch of `ahpio/ahpd` changes `docs/` since 2026-11-02. The fork's `maycxc/` branches from before then change sdk pages, and none adds a folder.

## The change

- A new folder, `docs/guide/`, holds one page per subject, for a person who uses ahpd.
- The 13 subjects:

| Page | Subject | Drawn from |
| --- | --- | --- |
| `SESSIONS.md` | Sessions that keep running when no client is connected | `sdk/SESSIONS.md`, `sdk/CHATS.md` |
| `CLIENTS.md` | Clients on any device: the web UI, the desktop app, ahpc, the phone app, VS Code | `server/CONNECT.md` |
| `AGENTS.md` | Agents: Claude, pi, ACP agents, cofold, and a custom one | `server/PLUGINS.md`, the four agent pages |
| `SUBSCRIPTIONS.md` | Subscriptions or API keys | `plugins/agent-claude.md`, `server/VAULT.md` |
| `MACHINES.md` | Isolated machines | `plugins/COMPUTERS.md`, `plugins/CONTAINERS.md` |
| `AUTOMATION.md` | Automation: schedules and webhooks | `sdk/AUTOMATIONS.md`, `plugins/WEBHOOKS.md` |
| `ACCESS.md` | Users, teams, roles and permissions | `server/USERS.md`, `sdk/USERS.md`, `sdk/AUTHENTICATION.md` |
| `DIAGNOSTICS.md` | Status, doctor, logs and telemetry | `server/RUN.md` |
| `SPENDING.md` | Usage and limits | `server/USAGE.md`, `sdk/USAGE.md`, `sdk/POLICY.md` |
| `GATEWAY.md` | The model gateway | `server/GATEWAY.md` |
| `PLUGINS.md` | Plugins: install, configure, write | `server/PLUGINS.md`, `plugins/PLUGINS.md` |
| `BOTS.md` | Bots: a talk, its Front and its Back | `plugins/BOTS.md` |
| `REMOTE.md` | Remote access: the token, tunnels, another network | `server/REMOTE.md`, `plugins/tunnel-devtunnel.md` |

- Each page says what the subject is, why a person uses it, how it works, and the commands and settings that drive it. It links the server, sdk and plugin pages for the detail, and copies none of it.
- `docs/README.md` gets a `guide` section first, for a person who uses ahpd. The sidebar gets a Guide group first, and the home page a Guide card first.
- The root README's capability titles link the guide pages: Subscriptions or API keys links `guide/SUBSCRIPTIONS`.

## Answers

| What | Source |
| --- | --- |
| A page per subject, not per command group | Softov, 2026-11-20: "One page per subject" |
| The pages land before 0.15.0 | Softov, 2026-11-20: "Before 0.15.0" |
| They live in a new `docs/guide/` section | Softov, 2026-11-20: "A new docs/guide/ section" |
| The 13 subjects: the README's 11, bots and remote access | Softov, 2026-11-20: "The 11, plus bots and remote access" |
| The README title links point at today's pages until the guide exists | Softov, 2026-11-20: "Commit and push now" |
| Subscriptions or API keys links the Claude plugin's page today | Softov, 2026-11-20: "subscriptions to agent-claude" |
| A guide page links the detail and copies none of it | (defaulted: a fact is written in one file) |
