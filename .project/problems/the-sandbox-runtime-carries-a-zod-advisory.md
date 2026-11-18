---
title: The sandbox runtime carries a zod advisory
status: open
date: 2026-11-18
severity: minor
refs:
  - "[code://packages/computer/package.json#L68](../../packages/computer/package.json#L68) - `@vscode/sandbox-runtime` pinned at 0.0.1, as VS Code pins it"
  - "[code://packages/computer/src/sandbox.ts](../../packages/computer/src/sandbox.ts) - where the computer plugin runs the runtime's CLI"
  - https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 - "Zod can exhaust memory while validating oversized constrained collections", fixed in zod 4.6.6
  - https://github.com/anthropics/sandbox-runtime - `@anthropic-ai/sandbox-runtime` 0.0.83, still on `zod ^3.25.0` on 2026-11-18
  - https://github.com/anthropics/sandbox-runtime/issues/778 - the issue asking the runtime to allow zod 4, with the finding that zod/v3 imports never load the flawed code
---

## Symptom

On 2026-11-18, `ahpd plugin update all` printed "3 high severity vulnerabilities" after each plugin it updated to 0.15.0-rc.4.
`npm audit` names one advisory, GHSA-mrhx-c7xc-m3w5, three times: `zod` 3.25.76, `@vscode/sandbox-runtime` 0.0.1 that depends on it, and `@ahpd/computer` that depends on the runtime.
A folder with `@ahpd/tunnel-devtunnel` also shows three moderate warnings: an old `uuid` in `@microsoft/dev-tunnels-connections`.
`npm audit fix --force` offers to move `@ahpd/computer` and `@ahpd/tunnel-devtunnel` to 0.14.0, which do not load on sdk 0.15.

## Cause

`@vscode/sandbox-runtime` 0.0.1 is an early release of Anthropic's sandbox runtime under VS Code's scope, and it depends on `zod ^3.24.1`.
Zod has the fix only in 4.6.6.
No release of the runtime uses zod 4: the VS Code package has no later release, and `@anthropic-ai/sandbox-runtime` 0.0.83 is on `zod ^3.25.0`.

## Impact

npm prints the warnings on every plugin install and update in the configuration folder.
The flawed code is not run. The advisory is in `$ZodArray.handleArrayResult`, which zod 3.25.76 ships only in its v4 core.
The runtime imports bare `zod`, which zod 3.25.76 resolves to its v3 code. On 2026-11-18, importing the runtime loaded 10 zod files and none under `v4/`.

## Workaround

None is needed. Do not run `npm audit fix --force`.

## Fix

No fix is chosen. Softov chose on 2026-11-18 to keep VS Code's runtime, and not to fork or vendor it.
A release of the runtime on zod 4, from VS Code or from Anthropic, ends the warnings.
