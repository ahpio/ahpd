---
title: The host's instructions read apart from the person's words
domain: host
status: built
priority: high
created: 2026-11-15
revalidated: 2026-11-15
changes:
  - specs/host-tools.md
refs:
  - git://a889c18fe - the last commit that holds the brief this plan covers, `briefs/the-artifact-tools-follow-their-root-config-key.md`
  - https://github.com/ahpio/ahpd/pull/344 - the artifact tools follow `artifactTools`, off by default, and the add tool's description carries their wording
  - "[code://packages/sdk/src/host/tooling.ts#L2946-L2956](../../../../packages/sdk/src/host/tooling.ts#L2946-L2956) - `instructions`, which filters the tools apart from `contributingTo`"
  - "[code://packages/sdk/src/host/tooling.ts#L2844-L2860](../../../../packages/sdk/src/host/tooling.ts#L2844-L2860) - `boundTools` and `offeredTools`, the tools a chat is handed"
  - "[code://packages/sdk/src/host/spawn.ts#L1268](../../../../packages/sdk/src/host/spawn.ts#L1268) - where a start's instructions are made, with `uri`, `chatUri` and the provider at hand"
  - "[code://packages/agent-acp/src/session/turn.ts#L295-L327](../../../../packages/agent-acp/src/session/turn.ts#L295-L327) - the session's and the turn's instructions, each a plain text block"
  - "[code://packages/agent-claude/src/session/query.ts#L190-L202](../../../../packages/agent-claude/src/session/query.ts#L190-L202) - the session's instructions on every prompt"
  - "[code://packages/agent-claude/src/session/query.ts#L1084-L1091](../../../../packages/agent-claude/src/session/query.ts#L1084-L1091) - where the CLI's `compact_boundary` is read"
  - https://github.com/microsoft/vscode/blob/1564f100807a/src/vs/platform/agentHost/node/chatContributions/artifactTools/artifactToolsContribution.ts#L30-L50 - the reference says its instruction once per chat, and counts a chat with turns as told
  - file:///home/softov/projects/ahp-analis/ahpd-config-defaults-report.md - the defaults report, whose `artifactTools` row is wrong
---

## Goal

What the host tells a model must never read as what the person typed, and must not fill every turn.
Today opencode, an ACP server, joins the host's block to the first message with no break. Claude is told the same text on every prompt.
The model must also never be told about a tool it was not handed.
#344 already gates the artifact tools on `artifactTools` and drops their instruction.
This plan does the rest of the brief in ahpd, and leaves a brief in ahpw and ahpc for the push of `artifactTools`.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "instructions\(" packages/sdk/src/host` - one caller, `spawn.ts` at the start of a chat.
- `rg "isEnabledForSession|topLevelChatOnly" packages/sdk/src/host/tooling.ts` - `offeredTools` checks both, `instructions` checks the first only.
- `rg "compact_boundary" packages/agent-claude/src` - one reader, in the query's message loop.
- `rg "root/configChanged" ahpw/src ahpc/src` - each client pushes only `workspaceTrust` and what Settings saves, never a default at connect.

### Runtime path

```
spawn -> tooling.instructions(uri, chatUri, provider) -> Start.instructions
  agent-acp: first prompt -> <host_instructions> block -> ACP server -> model
  agent-claude: UserPromptSubmit hook -> additionalContext (first prompt, and first after compact) -> model
```

### Gaps

- `instructions` and `boundTools` filter apart, so a gate in one is not in the other.
- No ACP block says it is the host's.
- agent-claude has no flag for "the session's instructions were given".

## Answers

| What | Source | Task |
| --- | --- | --- |
| `artifactTools` stays off by default in ahpd; ahpc and ahpw push `true` | Softov, 2026-11-15: "Off, clients push true" | 04 |
| A client pushes `artifactTools: true` at connect only when the root holds no value for it | Softov, 2026-11-15: "Only when unset" | 04 |
| ahpd is built now; ahpw and ahpc get a brief each, planned after | Softov, 2026-11-15: "ahpd now, clients after" | 04 |
| `agent-acp` wraps the instructions in a tag | Softov, 2026-11-15: "Wrap in a tag" | 02 |
| The tag is `<host_instructions>`, with a blank line after it | (defaulted: underscores, as the reference's `<remote_session_origin>`) | 02 |
| The session's block and the turn's block are both wrapped | (defaulted: either one glued to the text reads as the person's) | 02 |
| agent-claude gives the session's instructions once, and again after a compaction | Softov, 2026-11-15: "Once, again after compact" | 03 |
| A session opened with `resume` counts as told | (defaulted: the reference's `onHydrateTurns` marks a chat with turns as told) | 03 |
| `instructions` takes its tools from `boundTools` | (defaulted: the brief's open point, and #344's own proposal) | 01 |

## Proposed architecture

- **Data flow** - `instructions` reads the same `BoundTool` list a chat is handed, so the instructions and the tools come from one list.
- **Event flow** - agent-claude resets its flag on `compact_boundary`, and the next prompt gives the instructions again.
- **State flow** - agent-claude keeps `instructionsGiven` on the session context, so a new CLI for the same session does not repeat them.
- **Layer responsibilities** - sdk: which instructions a chat gets · agent-acp: how an ACP prompt marks them · agent-claude: when the CLI is given them.
- **Source-of-truth files** - [`code://packages/sdk/src/host/tooling.ts`](../../../../packages/sdk/src/host/tooling.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - instructions follow the bound tools](task-01-instructions-follow-the-bound-tools.md) | done | - |
| [02 - acp wraps the host instructions](task-02-acp-wraps-the-host-instructions.md) | done | - |
| [03 - claude tells once and after compact](task-03-claude-tells-once-and-after-compact.md) | done | - |
| [04 - ahpw and ahpc get a brief](task-04-ahpw-and-ahpc-get-a-brief.md) | done | - |

## Risks and tradeoffs

- A model told the session's instructions once may forget a client rule on a long chat - the reset at a compaction covers the case that drops the first turn.
- An ACP server may show the tag to the person - it is plain text, and the person sees less than the glued text shows now.
- Until ahpw and ahpc push `artifactTools`, their users have no artifact tools - the brief in each repository says so.

## Resume state

- **Done so far:** every task, on 2026-11-15. #344 merged as `addd41fcc`. See [implemented.md](implemented.md).
- **Next action:** none in ahpd. The briefs in ahpw and ahpc wait for a plan each.
- **Open questions:** none.
- **Watch out for:** a bare session gets no tool instructions now, since `instructions` reads `handedTools`.

## Final verification checklist

- [x] `pnpm typecheck` passes.
- [x] The tests of `packages/sdk`, `packages/agent-acp` and `packages/agent-claude` pass.
- [ ] CI is green on the pull request.
- [x] A brief exists in ahpw and in ahpc.
