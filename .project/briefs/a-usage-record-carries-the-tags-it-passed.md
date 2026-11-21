---
title: A usage record carries the tags of what it passed through
created: 2026-11-21
refs:
  - git://76ab8bbba2605c9bfa47cabc89fb262106aa3541 - the commit the facts were checked at
  - "[code://packages/sdk/src/types/usage.ts#L37-L80](../../packages/sdk/src/types/usage.ts#L37-L80) - `UsageBase`, the fields every record has"
  - "[code://packages/sdk/src/types/usage.ts#L74](../../packages/sdk/src/types/usage.ts#L74) - `meta`, the string map a proxy call with a key carries"
  - "[code://packages/sdk/src/types/usage.ts#L90](../../packages/sdk/src/types/usage.ts#L90) - `ModelCall.connector`, set on proxy calls only"
  - "[code://packages/sdk/src/usage/meter.ts#L248-L282](../../packages/sdk/src/usage/meter.ts#L248-L282) - `write`, where an agent turn's record is made"
  - "[code://packages/sdk/src/usage/meter.ts#L203](../../packages/sdk/src/usage/meter.ts#L203) - `poolsOf`, which adds a key once, the shape a tag set would copy"
  - "[code://packages/sdk/src/types/agents.ts#L53](../../packages/sdk/src/types/agents.ts#L53) - `AgentRecord`, with no field for tags"
  - "[code://packages/sdk/src/types/connectors.ts#L218](../../packages/sdk/src/types/connectors.ts#L218) - `Connector`, with no field for tags"
  - "[code://packages/agent-claude/src/logins.ts#L288](../../packages/agent-claude/src/logins.ts#L288) - a Claude agent's `logins`, a list of connector ids"
  - "[code://packages/agent-claude/src/logins.ts#L116](../../packages/agent-claude/src/logins.ts#L116) - `FAILOVER`, why a turn can run on another login than the first"
  - decisions/a-limit-counts-the-records-tagged-with-its-key.md - `pools` already holds the policy keys a record is charged to
  - ideas/usage-grouped-by-meta.md - the idea to group and filter records by one `meta` entry
  - https://docs.litellm.ai/docs/proxy/request_tags - LiteLLM tags a request for spend tracking, checked 2026-11-21
  - https://docs.litellm.ai/docs/proxy/tag_budgets - LiteLLM sets a budget per tag, checked 2026-11-21
  - https://langfuse.com/docs/observability/features/tags - Langfuse keeps tags as a string array on a trace, checked 2026-11-21
---

# A usage record carries the tags of what it passed through

Softov wants each usage record to carry string tags from each thing the work passed through.
An agent record and a connector each get tags, and each one that a turn passes adds its tags to the record.
A tag that is already on the record is not added again.
With this, two Claude agents with different tags are told apart in the totals.
A tag on a login connector says which account ran the work.
The same works for a model or any other thing that gets a tag later.

## What others do

- **LiteLLM** takes tags on each request, in the body's `metadata.tags` or in an `x-litellm-tags` header, and keeps them on the spend log row as `request_tags`. A budget can be set per tag. See [request tags](https://docs.litellm.ai/docs/proxy/request_tags) and [tag budgets](https://docs.litellm.ai/docs/proxy/tag_budgets).
- **Langfuse** keeps `tags` as an array of strings on a trace, each at most 200 characters. The API and the UI filter traces that hold all of the tags asked for. See [tags](https://langfuse.com/docs/observability/features/tags).

Both put the tags on the request record itself, as a plain list of strings.

## What ahpd has today

- A record names the agent record that ran it in `agent`, by its id, such as `claude`, `claude-deepseek` or `claude-deepseek-build`. Two Claude agents are already told apart by id, as [`UsageBase`](../../packages/sdk/src/types/usage.ts#L37-L80) says.
- `model.connector` names the connector only on a proxy call. An agent turn's record names no connector, as [`write`](../../packages/sdk/src/usage/meter.ts#L248-L282) shows.
- A Claude agent names its logins in `config.logins`, a list of connector ids ([`logins.ts`](../../packages/agent-claude/src/logins.ts#L288)). A turn can move to another login on a rate limit ([`FAILOVER`](../../packages/agent-claude/src/logins.ts#L116)). The record does not say which login ran the turn.
- `meta` is a map of strings on a proxy call made with a key ([`meta`](../../packages/sdk/src/types/usage.ts#L74)). It comes from the key and from the `X-AHP-Meta` header. No agent turn writes it.
- `pools` is a list of strings, and `poolsOf` adds each key once ([`poolsOf`](../../packages/sdk/src/usage/meter.ts#L203)). A pool is charged and counted against limits, as [the limit decision](../decisions/a-limit-counts-the-records-tagged-with-its-key.md) says. A tag is only a label.
- Neither [`AgentRecord`](../../packages/sdk/src/types/agents.ts#L53) nor [`Connector`](../../packages/sdk/src/types/connectors.ts#L218) has a field for tags.
- [The meta idea](../ideas/usage-grouped-by-meta.md) proposes to group and filter `ahpd usage` by one `meta` entry. Tags need the same grouping and filtering.

## Who writes

| Writer | Files | Effect of the change |
|---|---|---|
| `origin/main` | all | The base. |
| `fork/host-124-shell-integration`, `maycxc/host/124-an-agents-shell-is-a-terminal-the-person-sees` | `packages/agent-claude/src/session/query.ts`, 11 lines | Only the login tag touches this file. Rebase over it. |
| `maycxc/union-2026-10-30-0c75e15c`, `maycxc/union-2026-10-30-69c27900` | `packages/agent-claude/src/session/query.ts` | Old union branches. Check before the plan whether they still matter. |
| `maycxc/plugin/54-webhook-real-senders` | `packages/sdk/src/types/connectors.ts` | A tag field on `Connector` may meet this change. Rebase over it. |
| [The cost problem](../problems/a-resumed-claude-session-bills-its-whole-past-to-one-turn.md) | `packages/agent-claude/src/session/parts.ts`, `query.ts` | Its fix is a second plan on the same files. The two plans stack, or one waits. |

## The change

- An agent record has `tags`, a list of strings.
- A connector has `tags`, a list of strings.
- A usage record has `tags`, a list of strings with no repeats, in the order they were added.
- When a turn's record is written, it takes the tags of the agent record that ran it.
- A Claude turn's record also takes the tags of the login connector that ran it. When a turn moves to another login, both logins' tags are on the record.
- A proxy call's record takes the tags of the connector that served it.
- A record keeps the tags it was written with. An edit to a tag later changes no record already written.
- A tag is a label only. It is not a pool and charges nothing.
- `ahpd usage` and the usage resources filter and group records by tag.

## Open points

Each of these is asked before the plan is written:

- A tag is a plain string, or a `name: value` pair that adds to `meta`.
- Whether a model gets tags too, and where they are set.
- Whether a policy may match a tag, so a limit applies to all work with one tag.
- Whether a tag is on the record only, or also on the turn's `_meta` for a client to show.
