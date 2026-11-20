---
title: The server pages cover each command group
created: 2026-11-20
refs:
  - git://419d7ef17 - the commit of ahpd the facts were checked at
  - "[code://docs/server/VAULT.md](../../docs/server/VAULT.md) - a command group's page: an example, the command table, then a section per subject"
  - "[code://docs/server/USERS.md#L13-L36](../../docs/server/USERS.md#L13-L36) - the one line on `ahpd team` and `ahpd project`"
  - "[code://docs/plugins/COMPUTERS.md#L428-L490](../../docs/plugins/COMPUTERS.md#L428-L490) - *Joined nodes*, the one place `ahpd join` and `ahpd node` are described"
  - "[code://docs/sdk/AUTOMATIONS.md#L199-L355](../../docs/sdk/AUTOMATIONS.md#L199-L355) - where an automation is kept, its commands and its files, written for a developer"
  - "[code://docs/server/PLUGINS.md](../../docs/server/PLUGINS.md) - the plugin commands, without `available`, `apply` and `reload`"
  - "[code://packages/server/src/commands/nodes.ts](../../packages/server/src/commands/nodes.ts) - `node rm`, whose help says the token is refused from the next connection on"
  - https://docs.docker.com/reference/cli/docker/network/ - Docker's CLI docs, a page per command group with a line on each command
  - plans/documentation/20261120-0411-a-guide-page-for-each-subject/plan.md - the guide this replaces, dropped
---

# The server pages cover each command group

Softov wants `docs/server/` to have a page for each `ahpd` command group that has none, and the plugin page to cover its missing commands. A person who runs the daemon finds what each group is for and what each of its commands does. The pages land before 0.15.0. A separate guide folder is not wanted: the guide plan is dropped.

## What others do

- Docker's CLI docs give each command group a page, such as `docker network`, with what the group is for and a line on each command.
- ahpd's own server pages already do this for some groups: `VAULT.md`, `USAGE.md`, `GATEWAY.md` and `USERS.md`.
  Each opens with an example and a command table, then a section per subject.

## What ahpd has today

| Command group | Server page today |
| --- | --- |
| `team`, `project` | One line in `USERS.md`'s command table |
| `node`, `join` | None. *Joined nodes* in `plugins/COMPUTERS.md` describes them |
| `automation` (`list`, `export`, `import`) | None. `sdk/AUTOMATIONS.md` describes them, for a developer |
| `plugin` | `server/PLUGINS.md`, without `available`, `apply` and `reload`, and without the plugin lists |
| `user`, `token` | `server/USERS.md` |
| `vault`, `usage`, `gateway` | A page each |
| `doctor`, `service`, `paths`, `update`, `completion` | `server/RUN.md` and `server/UPGRADE.md` |

- A team and a project are what a person's memberships name. Work, usage pools, tokens and vault names are charged to them or scoped by them. `ahpd team add <id> --title` names one, and naming one again sets its title.
- `ahpd join <url>` dials a hub with a node's token and keeps the socket, joining again with a backoff of up to a minute. `ahpd node add <id>` mints the node's token, shown once. `ahpd node rm <id>` takes it out.
- `ahpd node rm --help` says the token "is refused from its next connection on". Since #382, a removed node is cut off at once.
- `ahpd automation list` shows each automation's id, name, folder, schedule and whether it is on. `export` writes ahpd's own automation file, or VS Code's with `--vscode`. `import` makes a new automation, switched off, in `--folder`.
- `ahpd plugin available` lists every entry of the lists `pluginMarketplaces` names. `plugin apply` loads what the configuration now names. `plugin reload` imports a plugin again after its code changed.

## Who writes

- #390 changes the root README and `docs/media/`, and no page under `docs/server/`.
- #389 changes `docs/updates/v0_15.md` only.
- No other branch of `ahpio/ahpd` changes `docs/server/` since 2026-11-02.

## The change

- `docs/server/TEAMS.md`: what a team and a project are for, and `ahpd team` and `ahpd project`.
- `docs/server/NODES.md`: a hub and the hosts that join it, and `ahpd join` and `ahpd node`. `COMPUTERS.md`'s *Joined nodes* links it for the commands.
- `docs/server/AUTOMATIONS.md`: automations for a person who runs the daemon, where their files are, and `ahpd automation`. It links `sdk/AUTOMATIONS.md` for the triggers and the runs.
- `docs/server/PLUGINS.md` gains `plugin available`, `plugin apply` and `plugin reload`, and the plugin lists.
- Each new page follows `VAULT.md`'s shape: an example, the command table, then a section per subject.
- `docs/README.md` and the sidebar list the three new pages.
- `node rm`'s help says a removed node is cut off at once.

## Answers

| What | Source |
| --- | --- |
| Pages under `docs/server/`, not a guide folder | Softov, 2026-11-20: "maybe we dont need a /guide but on server we need the missing pages." |
| TEAMS.md, AUTOMATIONS.md, NODES.md, and the gaps of PLUGINS.md | Softov, 2026-11-20, all four chosen |
| The pages land before 0.15.0 | Softov, 2026-11-20: "they are before 0.15. Its the documentation of things done." |
| A new page follows `VAULT.md`'s shape | (defaulted: a second instance copies the first one's shape) |
| A page links the sdk and plugin pages for the detail, and copies none of it | (defaulted: a fact is written in one file) |
