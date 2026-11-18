---
title: A plugin id case times out on its first import
status: open
date: 2026-11-18
severity: minor
blocks: []
refs:
  - "[code://packages/server/test/plugin-ids.test.ts#L21-L25](../../packages/server/test/plugin-ids.test.ts#L21-L25) - each case imports a plugin's module under the default 5 s limit"
  - "[problems/computer-cases-time-out-on-a-busy-machine.md](computer-cases-time-out-on-a-busy-machine.md) - the same limit met by other cases on this machine"
  - git://080548209 - main when the problem was read
---

## Symptom

On 2026-11-18 on Softov's machine, `plugin-ids.test.ts` was run alone on daemon/20261118-1105, with a load average near 3.
Two cases timed out at 5000 ms: `agent-acp/src/plugin.js exports the id agent-acp` and `agent-claude/src/plugin.js exports the id agent-claude`.
The branch does not change those plugins.
With a 60 s limit the file passed, and the agent-acp case took 7.7 s. The file's transform took 9.3 s.
The same file passed in a full server run on the same branch an hour before.

## Cause

Not known. The first case is the first import of a plugin's source. It pays for the transform of that plugin and the sdk it reaches. A cold transform cache is a guess.

## Impact

A run of the server suite can fail on a case that checks one string, which hides a real failure and costs a rerun.

## Workaround

None. A rerun passed, and a rerun is not a fix.
