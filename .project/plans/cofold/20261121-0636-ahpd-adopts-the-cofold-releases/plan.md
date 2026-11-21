---
title: ahpd adopts the cofold releases
domain: cofold
status: active
priority: medium
created: 2026-11-21
revalidated: 2026-11-21
requires: []
changes: []
creates: []
decisions: []
problems: []
refs:
  - git://fd7084712 - the commit of this repository the facts were checked at
  - git://f90a616 - the cofold commit the 2026-11-21 releases were tagged at
  - "[code://packages/agent-cofold/src/agent.ts#L168-L193](../../../../packages/agent-cofold/src/agent.ts#L168-L193) - the effort and permission copies, which are already cofold's imports except the labels"
  - "[code://packages/agent-cofold/src/tools.ts#L1-L40](../../../../packages/agent-cofold/src/tools.ts#L1-L40) - the hand-written table of cofold's tools and the fields they act on"
  - "[code://packages/agent-cofold/src/pauses.ts](../../../../packages/agent-cofold/src/pauses.ts) - the pause bookkeeping the cofold plan names by functions that no longer exist"
  - "[code://packages/agent-cofold/src/transcript.ts#L394-L430](../../../../packages/agent-cofold/src/transcript.ts#L394-L430) - how a message's source is shown, where `command` is not yet told apart"
  - "[code://packages/agent-acp/src/presets.ts#L214-L216](../../../../packages/agent-acp/src/presets.ts#L214-L216) - the copapo preset comment about `mcpServers`"
  - npm://@cofold/tools@0.4.2 - declares what each tool acts on (`subject`) and the read-before-write and dangling-link behaviour
  - npm://@cofold/agents@0.4.0 - `PERMISSION_MODES`, `PERMISSION_MODE_DESCRIPTIONS`, `EFFORT_LEVELS`, `effortOf`
---

## Goal

ahpd uses what the cofold releases of 2026-11-21 provide, and drops the copies that cofold now owns.
Each cofold item the cofold plans named for ahpd is checked against the code as it is today.
An item is built when the code needs it, and recorded as no change when the code already matches.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "PERMISSION_LABELS|PERMISSION_DESCRIPTIONS|EFFORT_LEVELS|effortOf" packages/agent-cofold/src` - the effort and permission names are already imported from `@cofold/agents`; only the labels are local.
- `rg "owePause|payPause|rejoin|route" packages/agent-cofold/src` - none of the names the cofold plan gives is in ahpd today.
- `rg "command.started|command.finished" packages/agent-cofold/src` - the events are mapped in `mapping.ts`.
- `npm pack @cofold/tools@0.4.2` and `rg subject dist` - the 0.4.2 package declares `subject` on each tool (`files.js`, `shell.js`, `web.js`, `memory.js`).

### Gaps

- The labels in `PERMISSION_LABELS` are host-owned: cofold's `modes.ts` says "the label a person reads stays the host's", so they stay.
- `@cofold/tools` is `^0.4.1` in ahpd and installed at 0.4.1. The `subject` declaration and the read-before-write switch are in 0.4.2.
- `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` names each new cofold version; 0.4.2 needs the same entry before it installs.
- Not found: a `reason` field on a turn cut in `transcript.ts`.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Build all eight, mechanical first | user, 2026-11-21: "All eight, mechanical first (Recommended)" | 01-08 |
| Permission labels stay host-owned | [code://packages/agent-cofold/src/agent.ts#L182-L190](../../../../packages/agent-cofold/src/agent.ts#L182-L190) and cofold's `modes.ts` comment, read 2026-11-21 | 01 |
| The terminal prompts are built first, in the configure plan | user, 2026-11-21 | - (see [configure plan](../../daemon/20261121-0636-configure-on-cofold-prompts/plan.md)) |

## Proposed architecture

- **Data flow** - the tool table in `tools.ts` is replaced by what each cofold tool declares.
- **Event flow** - `command.started` and `command.finished` are mapped already.
- **State flow** - none.
- **Layer responsibilities** - `packages/agent-cofold`: the tools, the transcript and the pauses; `packages/agent-acp`: the copapo preset comment.
- **Source-of-truth files** - [`code://packages/agent-cofold/src/agent.ts`](../../../../packages/agent-cofold/src/agent.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - the effort and permission copies](task-01-effort-and-permission-copies.md) | done | - |
| [02 - the terminal JSON failure](task-02-terminal-json-failure.md) | done | - |
| [03 - the pause workarounds](task-03-the-pause-workarounds.md) | todo | - |
| [04 - the tool table and the tools 0.4.2 bump](task-04-the-tool-table-and-tools-042.md) | todo | - |
| [05 - the command source](task-05-the-command-source.md) | todo | - |
| [06 - the turn-cut reason](task-06-the-turn-cut-reason.md) | todo | - |
| [07 - the copapo preset comment](task-07-the-copapo-preset-comment.md) | todo | - |
| [08 - the read-before-write and dangling-link switches](task-08-read-before-write-and-dangling-link.md) | todo | 04 |

## Risks and tradeoffs

- Task 04 changes which tools the model is offered for a file; a wrong `subject` changes an approval prompt. It is tested against each tool's current table row before the table is removed.
- Task 03 changes how a paused run resumes. It is the largest item, so it waits for its own pass.

## Resume state

- **Done so far:** tasks 01 and 02, checked on 2026-11-21, with no change to ahpd code.
- **Next action:** [task-04-the-tool-table-and-tools-042.md](task-04-the-tool-table-and-tools-042.md).
- **Open questions:** none.
- **Watch out for:** `pnpm install` runs in the worktree, and the `minimumReleaseAgeExclude` entry for a new cofold version must be added with it.

## Final verification checklist

- [ ] `pnpm typecheck` passes.
- [ ] `pnpm exec vitest run packages/agent-cofold packages/agent-acp` passes.
