---
title: A Claude question takes a typed answer
created: 2026-11-21
refs:
  - git://2360a50aa - the commit of ahpd the facts were checked at
  - "[code://packages/agent-claude/src/input.ts#L81-L117](../../packages/agent-claude/src/input.ts#L81-L117) - `questionRequest`, which builds the questions a person is asked"
  - "[code://packages/agent-claude/src/session/asking.ts#L583-L589](../../packages/agent-claude/src/session/asking.ts#L583-L589) - the answer handed back to the tool"
  - "[code://packages/agent-cofold/src/mapping.ts#L276](../../packages/agent-cofold/src/mapping.ts#L276) - cofold, which forbids a typed answer only where its question does"
  - "[code://packages/sdk/src/host/asking.ts#L92](../../packages/sdk/src/host/asking.ts#L92) - the host's own question tool, the same rule"
  - "[decisions/a-claude-question-allows-a-typed-answer.md](../decisions/a-claude-question-allows-a-typed-answer.md) - why ahpd departs from VS Code here"
  - git://github.com/microsoft/vscode@ddbdd50a9ed1 - `node/claude/claudeInteractiveTools.ts` L113 and L121
  - npm://@anthropic-ai/claude-agent-sdk@0.3.325 - `sdk-tools.d.ts`, the `AskUserQuestion` input
---

# A Claude question takes a typed answer

Softov saw Claude sessions send `"allowFreeformInput": false` on every question. A person can then only pick one of the model's options, while the model was told an Other choice is always there. Softov chose on 2026-11-21 that a Claude question allows a typed answer by default.

## What others do

- **The Claude Agent SDK.** Its `AskUserQuestion` options say "There should be no 'Other' option". They go on: "that will be provided automatically." The input has no field for a typed answer.
- **VS Code main** at `ddbdd50a9ed1` sends `allowFreeformInput: q.allowFreeformInput ?? false` (`claudeInteractiveTools.ts` L113, L121). That is `false` for every Claude question.

## What ahpd has today

- `questionRequest` sends `allowFreeformInput: question.allowFreeformInput === true` ([`code://packages/agent-claude/src/input.ts#L107`](../../packages/agent-claude/src/input.ts#L107)). That is `false` for every Claude question.
- A typed answer already reaches the tool: `freeformValues` are joined with the chosen options ([`code://packages/agent-claude/src/session/asking.ts#L583-L589`](../../packages/agent-claude/src/session/asking.ts#L583-L589)).
- cofold and the host's own question tool send `false` only where their question forbids a typed answer ([`code://packages/agent-cofold/src/mapping.ts#L276`](../../packages/agent-cofold/src/mapping.ts#L276), [`code://packages/sdk/src/host/asking.ts#L92`](../../packages/sdk/src/host/asking.ts#L92)).
- A question restored from a transcript is built by the same `questionRequest`, so it changes with a live one.

## Who writes

- **ahpd main.** No open branch changes `input.ts` on 2026-11-21.
- **MayCXC's fork.** No fork branch newer than 2026-11-02 is waiting to merge.

## The change

- A Claude question goes out with `allowFreeformInput: true`, unless its input says `false`, as [the decision](../decisions/a-claude-question-allows-a-typed-answer.md) records.
- A test checks both the live question and the one restored from a transcript.
