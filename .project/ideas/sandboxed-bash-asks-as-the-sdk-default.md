---
title: Sandboxed Bash asks as the SDK's default does
created: 2026-11-14
refs:
  - "[code://packages/agent-claude/src/options.ts#L39-L56](../../packages/agent-claude/src/options.ts#L39-L56) - the Claude `sandbox` option, which sends `autoAllowBashIfSandboxed: true` with `on` from the SDK 0.3.325 bump"
  - https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md - 0.3.325: sandboxed Bash commands are no longer approved without a prompt unless `autoAllowBashIfSandboxed` is set
---

Claude Agent SDK 0.3.325 stopped approving a sandboxed Bash command without a prompt by default.
ahpd keeps the old behaviour for now: its `sandbox: on` also sends `autoAllowBashIfSandboxed: true` (Softov, 2026-11-14).
In 0.16, check whether ahpd should take the SDK's default, so a sandboxed command goes through the permission flow like any other.
A session under `dontAsk` would then have such a command denied, which the check must cover.
