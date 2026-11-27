---
title: A box whose own ahpd has httpApi takes no session
status: open
date: 2026-11-27
severity: major
refs:
  - "[code://packages/server/src/commands/run.ts#L481-L485](../../packages/server/src/commands/run.ts#L481-L485) - `--stdio` stops the host when `httpApi` or `modelApi` is set"
  - "[code://docs/plugins/COMPUTERS.md#L401-L406](../../docs/plugins/COMPUTERS.md#L401-L406) - the host on a box reads the box's own `config.json`"
  - git://5f50448f0 - the commit `v0.16.0-rc.1` is on
---

## Symptom

On 2026-11-27, a host installed from `0.16.0-rc.1` started a cofold session on the ssh box `dev02`.
The install passed: `computer: ahpd 0.16.0-rc.1 was installed on dev02 at ...`.
The session then failed: `cofold's host inside computer://ssh.dev02 ended before its session started (it exited with code 2). It said: ahpd: httpApi needs a listening port, and --stdio serves one connection on this process's own pipes.`
dev02 runs an ahpd of its own, and its `config.json` sets `httpApi`.
A second session failed the same way.

## Cause

The host this host starts on a box runs with `--stdio` and reads the box's own `config.json`, as the docs say.
`run.ts` stops a `--stdio` host whose options hold `httpApi` or `modelApi`.
So a box that runs its own daemon with either key takes no session from another host.

## Impact

A person whose box already runs ahpd with the HTTP API cannot use it as an ssh machine. The session fails at once with a sentence about ports.

## Workaround

Name in the computer's `host` a command that starts an ahpd with a configuration of its own. Or remove `httpApi` from the box's `config.json`, which stops its own daemon's HTTP API.
