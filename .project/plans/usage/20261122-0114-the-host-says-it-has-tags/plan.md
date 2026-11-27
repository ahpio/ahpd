---
title: The host says it has tags
domain: usage
status: planned
priority: medium
created: 2026-11-22
revalidated: 2026-11-27
requires:
  - plans/usage/20261121-1733-a-record-carries-its-tags/plan.md
changes:
  - specs/usage.md
refs:
  - git://a3928e2b9 - main when the plan was made
  - git://f0e09da1c - main when the refs were read again, before the build
  - git://2cc11c839 - the last commit that holds the brief `briefs/ahpw-sets-tags-and-groups-usage-by-them.md`
  - "[code://packages/sdk/src/usage/usage.ts#L492-L505](../../../../packages/sdk/src/usage/usage.ts#L492-L505) - `keysOf`, which gives a record no row by tag when it has no tag"
  - "[code://packages/sdk/src/host/handshake.ts#L639](../../../../packages/sdk/src/host/handshake.ts#L639) - `ahpd.channels` in the root `_meta` of the `initialize` answer, the place for the new key"
  - "[code://packages/sdk/src/host/root.ts#L923](../../../../packages/sdk/src/host/root.ts#L923) - `ahpd.channels` in the root state's `_meta`, which repeats the handshake's keys"
  - "[code://packages/sdk/test/usage-scheme.test.ts#L493-L521](../../../../packages/sdk/test/usage-scheme.test.ts#L493-L521) - the case that sums by tag"
  - "[code://packages/sdk/test/plugin-host.test.ts#L533-L545](../../../../packages/sdk/test/plugin-host.test.ts#L533-L545) - a case that reads a key on the `initialize` answer and on the root state"
  - "[code://docs/sdk/USAGE.md#L86](../../../../docs/sdk/USAGE.md#L86) - the docs on groups by tag"
---

## Goal

ahpw is to set tags on agents and connectors, and group usage by them, only on a host that has tags.
The host says it has tags when a client connects.
Grouped by tag, the usage with no tag gets its own row, so the rows account for all usage.
User and team groups already do this for a missing key.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "'ahpd\.[a-zA-Z]*'" packages/sdk/src/host` - the root `_meta` keys: `ahpd.channels`, `ahpd.methods`, `ahpd.grants`, `ahpd.principal`, `ahpd.resourceProviders` and `ahpd.automations`.
- `rg "ahpd.grants" packages/sdk/test` - `plugin-host.test.ts` reads a key on the `initialize` answer and on the root state.
- `git diff origin/main...<branch> -- packages/sdk/src/host` over every branch - on 2026-11-27, no open branch changes `handshake.ts`.

### Runtime path

```
client initialize -> handshake.ts root _meta -> 'ahpd.tags' -> ahpw Offers
usage://groups?by=tag -> keysOf -> one row per tag, and one with no tag -> ahpw "By tag" rows
```

### Gaps

- The root `_meta` names no tags support, so a client cannot tell a host on 0.15.0 from one with tags.
- `keysOf` returns no key set for a record with no tag, so grouped by tag that usage is in no row.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The host says it has tags in the root `_meta` of `initialize`, which ahpw reads | Softov, 2026-11-21: "its cant be sent on the initialize with root _meta?" | 02 |
| The key is `'ahpd.tags': {}`, an object that can carry the tags channel's template later | Softov, 2026-11-21, chose "Use {}" | 02 |
| A flag now, and a tags channel later when suggestions or a tag filter need the list | Softov, 2026-11-21, chose "Flag now, channel later" | 02 |
| The key is in the root state's `_meta` too, as `ahpd.channels` is | (defaulted: [code://packages/sdk/src/host/root.ts#L923](../../../../packages/sdk/src/host/root.ts#L923)) | 02 |
| Grouped by tag, the host sends a row with no tag for the usage that has none | Softov, 2026-11-22, chose "The host sends a no-tag row" | 01 |

## Proposed architecture

- **Data flow** - `keysOf` returns the record's other keys with no `tag` when the record has no tag, as it leaves out a missing team.
- **State flow** - `'ahpd.tags': {}` is constant: every host of this version has tags.
- **Layer responsibilities** - sdk: the handshake, the root state and the usage groups. server: nothing.
- **Source-of-truth files** - [`code://packages/sdk/src/host/handshake.ts`](../../../../packages/sdk/src/host/handshake.ts), [`code://packages/sdk/src/usage/usage.ts`](../../../../packages/sdk/src/usage/usage.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - Usage with no tag has its row](task-01-usage-with-no-tag-has-its-row.md) | todo | - |
| [02 - The handshake says it has tags](task-02-the-handshake-says-it-has-tags.md) | todo | - |

## Risks and tradeoffs

- A row with no tag changes what `by=tag` answers. ahpw does not read `by=tag` yet, so no client depends on the old answer.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-usage-with-no-tag-has-its-row.md](task-01-usage-with-no-tag-has-its-row.md).
- **Open questions:** none.
- **Watch out for:** `tag=<a>` still keeps only the records that hold every tag named.
  A record with no tag is never in a filtered read.

## Final verification checklist

- [ ] `usage://groups?by=tag` answers a row with no `tag` key for the usage with no tag.
- [ ] The `initialize` answer and the root state both carry `'ahpd.tags': {}`.
- [ ] `pnpm typecheck` and the sdk suite pass.
