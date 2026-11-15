---
title: The model proxy is the model gateway
created: 2026-11-15
refs:
  - git://7bc308a23 - the commit of ahpd the facts were checked at
  - git://v0.13.0 - the release that named the key `modelProxy` and already held every name the change renames
  - git://v0.14.0 - the last release, which holds the same names
  - "[code://packages/server/src/config.ts#L613](../../packages/server/src/config.ts#L613) - the `modelProxy` key of `Config`"
  - "[code://packages/server/src/config.ts#L1000-L1003](../../packages/server/src/config.ts#L1000-L1003) - `RENAMED_KEYS`, which reads `proxy` as `modelProxy`"
  - "[code://packages/server/src/proxy/providers.ts#L67-L180](../../packages/server/src/proxy/providers.ts#L67-L180) - `modelProxy.sessionCalls`, `modelProxy.keyRefusal`, `PROVIDERS_GONE` and the check of `modelProxy.models`"
  - "[code://packages/server/src/commands/proxy.ts#L41-L45](../../packages/server/src/commands/proxy.ts#L41-L45) - the `proxy.list` command, at `ahpd proxy list` and `GET /proxy/list`"
  - "[code://packages/sdk/src/access/users.ts#L71-L74](../../packages/sdk/src/access/users.ts#L71-L74) - the `proxy` subject in the list of subjects"
  - "[code://packages/sdk/src/access/users.ts#L235-L244](../../packages/sdk/src/access/users.ts#L235-L244) - the `proxy` subject's title, `Model proxy`, beside `MCP gateway`"
  - "[code://packages/sdk/src/access/users.ts#L1280](../../packages/sdk/src/access/users.ts#L1280) - a team key answers only `proxy:call` and `proxy:models`"
  - "[code://packages/sdk/src/access/users.ts#L1778-L1782](../../packages/sdk/src/access/users.ts#L1778-L1782) - the grants a team key may be minted with"
  - "[code://packages/sdk/src/access/users.ts#L306-L323](../../packages/sdk/src/access/users.ts#L306-L323) - `grantProblem`, which takes any operation on a subject the table does not know"
  - "[code://packages/sdk/src/access/tokens.ts#L155-L160](../../packages/sdk/src/access/tokens.ts#L155-L160) - minting a team key needs `proxy:call`"
  - "[code://packages/server/src/commands/token.ts#L255](../../packages/server/src/commands/token.ts#L255) - the same bound on `ahpd token`"
  - "[code://packages/server/src/proxy/listener.ts#L756](../../packages/server/src/proxy/listener.ts#L756) - a model call asks for `proxy:call`"
  - "[code://packages/server/src/proxy/listener.ts#L1182-L1202](../../packages/server/src/proxy/listener.ts#L1182-L1202) - a model call's usage record, `source: 'proxy'`"
  - "[code://packages/sdk/src/types/usage.ts#L41](../../packages/sdk/src/types/usage.ts#L41) - the usage sources"
  - "[code://packages/sdk/src/types/policies.ts#L41](../../packages/sdk/src/types/policies.ts#L41) - the policy value types"
  - "[code://packages/sdk/src/access/policies.ts#L38-L44](../../packages/sdk/src/access/policies.ts#L38-L44) - the `proxy` policy value, under `model`"
  - "[code://packages/sdk/src/access/decide.ts#L59](../../packages/sdk/src/access/decide.ts#L59) - the same values where a policy is decided"
  - "[code://packages/server/test/config-check.test.ts#L195-L209](../../packages/server/test/config-check.test.ts#L195-L209) - an unknown key is warned about and ignored"
  - "[code://docs/server/PROXY.md](../../docs/server/PROXY.md) - the page on the model proxy"
  - "[code://.project/plans/proxy/00-proxy.md](../plans/proxy/00-proxy.md) - the proxy domain and its words"
  - https://github.com/ahpio/ahpw/blob/7496ed4/src/resources/host/sections.ts#L16-L19 - ahpw reads the `modelProxy` section, or `proxy` from a host before 0.13
  - https://github.com/ahpio/ahpw/blob/7496ed4/src/i18n/en.json#L2267 - ahpw's label for the section, `Model proxy`, with `es` and `pt` on the same line
---

# The model proxy is the model gateway

Softov wants the model proxy named the model gateway in every layer before 0.15 is released. The words a person reads, the config key, the command, the route and the stored names all change. Old names are not read: a host updating from 0.14 changes its files by hand. Softov chose this on 2026-11-15, after he was told that the names shipped in 0.13 and 0.14.

## What ahpd has today

The names, each in `v0.13.0`, `v0.14.0` and main:

| Layer | Name today | Where |
|---|---|---|
| Config | `modelProxy`, with `models`, `sessionCalls` and `keyRefusal` | [`code://packages/server/src/config.ts`](../../packages/server/src/config.ts#L613), [`code://packages/server/src/proxy/providers.ts`](../../packages/server/src/proxy/providers.ts#L67-L180) |
| Config | `proxy`, read as `modelProxy` by `RENAMED_KEYS` | [`code://packages/server/src/config.ts`](../../packages/server/src/config.ts#L1000-L1003) |
| Command | `ahpd proxy list`, `GET /proxy/list`, id `proxy.list` | [`code://packages/server/src/commands/proxy.ts`](../../packages/server/src/commands/proxy.ts#L41-L45) |
| Grant | `proxy:call`, `proxy:models`, subject `proxy` titled `Model proxy` | [`code://packages/sdk/src/access/users.ts`](../../packages/sdk/src/access/users.ts#L235-L244) |
| Policy | the value type `proxy` | [`code://packages/sdk/src/access/policies.ts`](../../packages/sdk/src/access/policies.ts#L38-L44) |
| Usage | `source: 'proxy'` on a model call's record | [`code://packages/server/src/proxy/listener.ts`](../../packages/server/src/proxy/listener.ts#L1182-L1202) |
| Words | "model proxy" in docs, help and the release notes | `docs/server/PROXY.md` and 17 other files in `docs`, `README.md` and the package READMEs |

`MCP gateway` is already the title of the `mcp` subject, so `Model gateway` is a sibling of it. Nothing else in ahpd calls itself a gateway: the other uses are Docker's `host-gateway` and third-party gateways in comments.

An old name after the change does this:

- A `modelProxy` or `proxy` key is a key ahpd does not know. It is warned about as `<file>: modelProxy is not a setting ahpd knows; ignored`, and the daemon starts with no model table ([`code://packages/server/test/config-check.test.ts`](../../packages/server/test/config-check.test.ts#L195-L209)).
- A role that holds `proxy:call` is still read, because `grantProblem` takes any operation on a subject the table does not know ([`code://packages/sdk/src/access/users.ts`](../../packages/sdk/src/access/users.ts#L306-L323)). The grant matches nothing, so the role can no longer call a model.
- A team key minted with `proxy:call` answers no call, because a team key answers only its two gateway grants ([`code://packages/sdk/src/access/users.ts`](../../packages/sdk/src/access/users.ts#L1280)).
- A policy that names the value type `proxy` and usage records with `source: 'proxy'` keep the old word on disk.
- `ahpd proxy list` and `GET /proxy/list` are unknown.

## Who writes

| Writer | What it changes | What this change does to it |
|---|---|---|
| The session on `host/20261115-1038-comments-on-a-resource` | Plans C and D, comments on a resource, not yet merged | None of the renamed names. It rebases on the rename if the rename merges first. |
| ahpw | Reads the `modelProxy` section and labels it | ahpw reads `modelGateway` and drops the `proxy` alias, in its own PR after ahpd's |
| MayCXC's fork | Branches up to 2026-11-01, some with `modelProxy` lines | No open branch from after 2026-11-01. A later merge of an old branch brings old names back, so its review greps them. |

## The change

- The config key is `modelGateway`, with `models`, `sessionCalls` and `keyRefusal` unchanged under it.
- `RENAMED_KEYS` loses its `proxy` row, and gets no `modelProxy` row.
- The command is `gateway.list`, at `ahpd gateway list` and `GET /gateway/list`.
- The grant subject is `gateway`, titled `Model gateway`, with `gateway:call` and `gateway:models`.
- The policy value type is `gateway`, and a model call's usage record says `source: 'gateway'`.
- The words are "model gateway" in docs, help text, error text and comments. `docs/server/PROXY.md` becomes `docs/server/GATEWAY.md`, and every link to it follows.
- `docs/updates/v0_15.md` says under its breaking changes what each old name becomes, and that old names are not read. `docs/server/UPGRADE.md` lists the same names.
- `v0_13.md` and `v0_14.md` keep their words, since they say what those releases did.
- The proxy domain's `00-proxy.md` names the thing "model gateway". The domain folder keeps its path, and past plans keep their words.
- The code keeps its own names: the folder `packages/server/src/proxy/`, `proxyHandler`, `PROXY_PREFIX` and the test file names. Softov saw this scope in the table of layers on 2026-11-15.
- The nested session proxy, such as `nested-proxy.test.ts`, is a different thing and keeps its name.
- ahpw reads `modelGateway`, labels it `Model gateway` in `en`, `Gateway de modelos` in `pt` and `es`, and drops its `proxy` alias.
