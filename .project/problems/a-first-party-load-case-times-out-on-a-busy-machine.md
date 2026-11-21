---
title: A first-party load case times out on a busy machine
status: open
date: 2026-11-16
severity: minor
blocks: []
refs:
  - "[code://packages/server/test/plugin-load.test.ts#L342-L366](../../packages/server/test/plugin-load.test.ts#L342-L366) - each first-party plugin loaded from its source, under the default 5 s limit"
  - "[code://vitest.config.ts#L34](../../vitest.config.ts#L34) - the 5 s limit off Windows"
  - "[problems/computer-cases-time-out-on-a-busy-machine.md](computer-cases-time-out-on-a-busy-machine.md) - the same kind of timeout in the computer suite"
  - git://2cf789740 - main when the problem was read
---

## Symptom

Seen on 2026-11-16 on Softov's machine, in a full run of the server suite on the branch of plugin/20261116-1816.
The load average was near 10, and the run took 135 s.
`plugin-load.test.ts`: `a first-party plugin > loads bot with the options schema in its package.json` timed out at 5000 ms.
The same file alone passed, and the bot case took 2038 ms.
The branch does not change the loader or `packages/bot`.

On 2026-11-17, at `c75b479ad` of plugin/20261117-0701, the same case timed out at 5000 ms in a full run of the server suite.
The load average was near 15. That branch changes only `tunnel-devtunnel`.

On 2026-11-21, on host/20261121-0821-an-automation-continues-a-session-or-a-chat, `loads bot with the options schema in its package.json` timed out at 5000 ms in a full run of the server suite. The load average was near 15. The file passed alone, 59 cases, and the branch does not change plugin loading.

## Cause

Unknown.
Each case imports a plugin's `src/index.ts` through the vite transform.
The first import of a package with many modules is slow on a busy machine.

## Impact

A full server run on a busy machine can fail for no fault.
CI has not shown it.

## Workaround

None. A rerun is not a fix.

## Fix

Candidate fixes, none chosen yet:

- Give each case of the first-party load a limit of its own, as long as the slowest import needs.
- Load the built `dist` of each plugin in place of its source, once the build is part of the test setup.
