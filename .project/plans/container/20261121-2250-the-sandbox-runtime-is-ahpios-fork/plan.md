---
title: The sandbox runtime is ahpio's fork
domain: container
status: planned
priority: high
created: 2026-11-21
revalidated: 2026-11-21
refs:
  - git://8a5a86a5c - main when the plan was made, and the last commit that holds `briefs/ahpio-sandbox-runtime.md` and `problems/the-sandbox-runtime-carries-a-zod-advisory.md`
  - "[code://packages/computer/package.json#L68](../../../../packages/computer/package.json#L68) - `@vscode/sandbox-runtime` pinned at 0.0.1"
  - "[code://packages/computer/src/sandbox.ts#L165](../../../../packages/computer/src/sandbox.ts#L165) - where the runtime's CLI is found"
  - "[code://packages/computer/src/sandbox.ts#L209-L214](../../../../packages/computer/src/sandbox.ts#L209-L214) - `network.enabled: false` for a network allowed whole"
  - "[code://packages/computer/src/sandbox.ts#L292](../../../../packages/computer/src/sandbox.ts#L292) - `SandboxManager.checkDependencies()`"
  - https://github.com/anthropics/sandbox-runtime - the upstream, Apache-2.0, tag `v0.0.83` at `0bbebed0aa9a`
  - https://github.com/anthropics/sandbox-runtime/pull/246 - the `network.enabled` gate VS Code's build carries, read for its behaviour only
  - https://github.com/anthropics/sandbox-runtime/blob/v0.0.83/.github/workflows/release.yml - the release the fork keeps
---

## Goal

The computer plugin runs on `@ahpio/sandbox-runtime`, Softov's fork of Anthropic's sandbox runtime, built and released the way Anthropic releases it. The fork adds two things: a network gate that lets a chat allow the whole network, and zod at a version with the advisory's fix. This moves ahpd off VS Code's old 0.0.1 build and keeps the setting it already writes.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note. The facts were checked on 2026-11-21 and were in `briefs/ahpio-sandbox-runtime.md`, which this plan replaces.

### Searches performed

- `gh repo view ahpio/sandbox-runtime` - no such repository.
- `npm view @ahpio/sandbox-runtime` - no such package.
- 0.0.83's `NetworkConfigSchema` - refuses `*`, `*.*`, `*:443` and `*.com` in `allowedDomains`, and drops `enabled: false` without a word.

### Runtime path

```
ahpio/sandbox-runtime, cut at v0.0.83 + network.enabled + zod ^4.6.6 -> release.yml -> npm @ahpio/sandbox-runtime
packages/computer -> @ahpio/sandbox-runtime (exact) -> srt --settings <file> -> network.enabled: false keeps the filesystem rules only
```

### Gaps

- 0.0.83 has no way to allow the whole network.
- 0.0.83 asks for `zod ^3.25.0`, and only zod 4.6.6 has the advisory's fix.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The runtime is `@ahpio/sandbox-runtime`, a fork, built and released as Anthropic does | Softov, 2026-11-21, "we fork, adjust and release for our use", "we build it like they do for the release", "@ahpio is mine" | 01, 02 |
| The network gate is written against 0.0.83's code, not by rebasing PR #246 | Softov, 2026-11-21, "the network don't need to be the same code. its a gate I think." | 01 |
| Plan the runtime switch now, with the certificate plan on top | Softov, 2026-11-21, "Plan the runtime switch and the CA (Recommended)" | 01, 02, 03 |
| I make the fork with `gh repo fork anthropics/sandbox-runtime --org ahpio`, after Softov's yes at build time; Softov does the first npm publish and the trusted publisher | Softov, 2026-11-21, "I fork it on your yes; you do npm (Recommended)" | 01, 02 |
| `network.enabled: false` starts no proxy, allows every request, and applies no network restriction; every filesystem rule stays | (defaulted: PR #246's behaviour) | 01 |
| zod is allowed at `^3.25.0 \|\| ^4.6.6`, since the `zod/v3` imports work under both | (defaulted: the brief's check) | 01 |
| The fork's version is `0.0.83-ahpio.1`, published with `--tag latest` | (defaulted: a prerelease of the upstream tag cannot clash with Anthropic's next version) | 01 |
| The fork keeps Apache-2.0, and a `NOTICE` names the two changes | (defaulted: Apache-2.0 section 4) | 01 |
| The computer plugin pins the fork at one exact version, and its Node floor is `>=22.12.0` | (defaulted: the runtime's `engines`) | 03 |
| The zod advisory's problem file is deleted with this plan, since its fix is planned | (defaulted: do-spec's rule for a problem) | - |
| The gate is tested on Linux, macOS and Windows, since all three wrappers read it | (defaulted: srt's `needsNetworkRestriction`, and Windows CI blocks a merge) | 01 |

## Proposed architecture

- **Data flow** - the fork's `release.yml` builds `apply-seccomp`, the Java agent and `srt-win`, packs, verifies on Windows, and publishes from the `npm` environment.
- **Layer responsibilities** - ahpio/sandbox-runtime: the gate, the zod range and the release; computer: the dependency and the paths.
- **Source-of-truth files** - the fork's `src/sandbox/sandbox-config.ts`, and [`code://packages/computer/src/sandbox.ts`](../../../../packages/computer/src/sandbox.ts).

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The fork has the gate and the zod range](task-01-the-fork-has-the-gate-and-zod.md) | todo | - |
| [02 - The fork's first release is on npm](task-02-the-forks-first-release.md) | todo | 01 |
| [03 - The computer plugin runs on the fork](task-03-the-plugin-runs-on-the-fork.md) | todo | 02 |

## Risks and tradeoffs

- Each upstream release needs a merge into the fork, with the gate kept. The gate's tests fail a merge that loses it.
- A fork is a public repository under ahpio. Making it waits for Softov's yes.

## Resume state

- **Done so far:** nothing.
- **Next action:** ask Softov for his yes to make the fork, then [task-01-the-fork-has-the-gate-and-zod.md](task-01-the-fork-has-the-gate-and-zod.md).
- **Open questions:** none.
- **Watch out for:** task 01's paths are in the fork's repository, not in ahpd's.

## Final verification checklist

- [ ] The fork's tests pass, with the gate's tests among them, and its `release.yml` passes on a pull request.
- [ ] `npm view @ahpio/sandbox-runtime@0.0.83-ahpio.1` answers, with provenance.
- [ ] A test in ahpd: a chat that allows the whole network reaches a host outside any list, and keeps its filesystem rules.
- [ ] The computer suite passes, and `pnpm audit` no longer reports the zod advisory.
