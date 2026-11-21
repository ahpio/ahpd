---
title: The sandbox runtime is @ahpio/sandbox-runtime
created: 2026-11-21
refs:
  - git://567d641b6 - main when the facts were checked
  - "[code://packages/computer/package.json#L68](../../packages/computer/package.json#L68) - `@vscode/sandbox-runtime` pinned at 0.0.1"
  - "[code://packages/computer/src/sandbox.ts#L209-L214](../../packages/computer/src/sandbox.ts#L209-L214) - the settings ahpd writes, `network.enabled: false` for a network allowed whole"
  - "[code://packages/computer/src/sandbox.ts#L165](../../packages/computer/src/sandbox.ts#L165) - where the runtime's CLI is found"
  - "[code://packages/computer/src/sandbox.ts#L292-L293](../../packages/computer/src/sandbox.ts#L292-L293) - `SandboxManager.checkDependencies()`"
  - "[problems/the-sandbox-runtime-carries-a-zod-advisory.md](../problems/the-sandbox-runtime-carries-a-zod-advisory.md) - the zod advisory this ends"
  - https://github.com/anthropics/sandbox-runtime - the upstream, Apache-2.0, tag `v0.0.83` at `0bbebed0aa9a`
  - https://github.com/anthropics/sandbox-runtime/pull/246 - Microsoft's open PR that adds `network.enabled`, which VS Code's 0.0.1 carries
  - https://github.com/anthropics/sandbox-runtime/issues/778 - the open issue asking upstream to allow zod ^4.6.6
  - https://github.com/anthropics/sandbox-runtime/blob/main/.github/workflows/release.yml - how upstream builds and publishes a release
---

# The sandbox runtime is @ahpio/sandbox-runtime

Softov wants the computer plugin on a sandbox runtime of his own: `@ahpio/sandbox-runtime`, a fork of Anthropic's runtime. It has two changes, and it is built and released the way Anthropic releases it. The two changes are a network gate that lets a chat allow the whole network, and zod allowed at a version with the advisory's fix. This moves ahpd off `@vscode/sandbox-runtime` 0.0.1, VS Code's old build, while keeping the setting VS Code's build understands.

## What others do

- **VS Code** pins `@vscode/sandbox-runtime` 0.0.1 in its `package.json` at `ddbdd50a9ed1` and on main. That package is a build of Microsoft's fork, published on 2026-05-03, and it carries the network switch of PR #246. Its only other release is `0.0.49-dev`.
- **Anthropic** publishes `@anthropic-ai/sandbox-runtime`, at 0.0.83 on 2026-11-13. It has the same entry points ahpd uses: `dist/cli.js` as `srt`, and `SandboxManager` from `dist/index.js`. It needs Node `>=22.12.0`.
- **Anthropic's release** is `.github/workflows/release.yml`, run on a published GitHub release and on each pull request without the publish:
  - `build-seccomp` builds `apply-seccomp` on `ubuntu-24.04` and `ubuntu-24.04-arm`;
  - `build-java-agent` builds the JVM proxy agent;
  - `build-srt-win` builds `srt-win.exe` for x64 and arm64;
  - `pack` makes the tarball from those artifacts;
  - `verify-package` checks it on `windows-latest`;
  - `publish` runs in the `npm` environment and calls `npm publish ./*.tgz --access public` with trusted publishing, which attaches provenance.
- **PR #246** is a gate, 7 files with +175 and -16 lines. With `network.enabled` set to `false`, `initialize` starts no proxies and `filterNetworkRequest` allows every request. `getNetworkRestrictionConfig` then answers `{ enabled: false }`, and `wrapWithSandbox` applies no network restriction, while the filesystem rules stay. It is based 587 commits before `v0.0.83`, and GitHub marks it as in conflict.

## What ahpd has today

- `@vscode/sandbox-runtime` 0.0.1 in `packages/computer/package.json`, used through its CLI (`--settings <file> -c <command>`, `--settings <file> -- <command>`) and through `SandboxManager.checkDependencies()`.
- A machine runs `srt -c true` from its own `PATH` to check the runtime is there. Nothing in ahpd installs `srt` in a machine.
- `sandboxSettingsOf` writes `network: { allowedDomains: [], deniedDomains: [], enabled: false }` when a chat's sandbox allows the whole network.
- Tested on 2026-11-21 against 0.0.83's own `NetworkConfigSchema`:
  - `allowedDomains` refuses `*`, `*.*`, `*:443` and `*.com`, as patterns too broad.
  - `{ enabled: false, ... }` is accepted, and parses as `{ allowedDomains: [], deniedDomains: [] }`: the key is dropped, and the command gets no network.
- 0.0.83's schemas import `zod/v3`, which is the v3 API under zod 3.25 and zod 4 alike. Its `package.json` asks for `zod ^3.25.0`, and zod has the advisory's fix only from 4.6.6.
- The package ships 8.9 MB of built files in `vendor/`: `seccomp/{x64,arm64}/apply-seccomp`, `srt-win/{x64,arm64}/srt-win.exe` and `java-proxy-agent/srt-proxy-agent.jar`.
- `@ahpio/sandbox-runtime` is free on npm, and the `@ahpio` scope is Softov's.

## Who writes

- `packages/computer/package.json` and `packages/computer/src/sandbox.ts`: no open branch or PR of ahpd changes them now.
- The fork is a new repository, so nothing else writes it.

## The change

- A repository `ahpio/sandbox-runtime` is a GitHub fork of `anthropics/sandbox-runtime`, cut at `v0.0.83`, with the Apache-2.0 license and a notice of what changed.
- The fork adds a network gate under the key `network.enabled`, the key VS Code's build and ahpd's settings already use. It is written against `v0.0.83`'s code, not by rebasing #246: `false` skips the proxies and the network restriction, and keeps every filesystem rule.
- The fork allows zod at `^4.6.6`, which its `zod/v3` imports already work with.
- The fork keeps Anthropic's `release.yml`: the same build jobs and the same verification, publishing `@ahpio/sandbox-runtime` with npm trusted publishing from `ahpio/sandbox-runtime`.
- Each release of the fork is a merge of an upstream tag, with the two changes kept, and tests of the gate.
- The computer plugin depends on `@ahpio/sandbox-runtime` at one exact version, and finds its CLI and `SandboxManager` under that name.
- The computer plugin's Node floor follows the runtime's `>=22.12.0`.
- The zod advisory's problem file is deleted once the plugin is on the fork.
