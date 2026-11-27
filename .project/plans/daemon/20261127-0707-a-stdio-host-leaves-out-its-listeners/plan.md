---
title: A stdio host leaves out its listeners
domain: daemon
status: active
priority: high
created: 2026-11-27
revalidated: 2026-11-27
refs:
  - git://df65c4987 - main when the plan was made, and the last commit that holds the problem file `a-box-whose-own-ahpd-has-httpapi-takes-no-session.md`
  - "[code://packages/server/src/commands/run.ts#L481-L485](../../../../packages/server/src/commands/run.ts#L481-L485) - the refusal of `httpApi` and `modelApi` under `--stdio`"
  - "[code://packages/server/src/commands/run.ts#L498-L500](../../../../packages/server/src/commands/run.ts#L498-L500) - the refusal of `routes` under `--stdio`"
  - "[code://packages/server/src/commands/options.ts#L1042](../../../../packages/server/src/commands/options.ts#L1042) - `FILE_ONLY`: the three keys come from the configuration file only"
  - "[code://packages/computer/src/plugin.ts#L1920-L1928](../../../../packages/computer/src/plugin.ts#L1920-L1928) - the box host starts with `--stdio` and reads the box's own file"
  - "[code://packages/server/test/plugin-route.test.ts#L294-L297](../../../../packages/server/test/plugin-route.test.ts#L294-L297) - the case of `routes` and `--stdio`"
  - "[code://docs/plugins/COMPUTERS.md#L404](../../../../docs/plugins/COMPUTERS.md#L404) - the host on a box reads the box's own `config.json`"
---

## Goal

A box whose own ahpd serves the HTTP API takes a session from another host. On 2026-11-27, every cofold session on dev02 failed that way on `0.16.0-rc.1`.

## Reconnaissance

- The computer plugin starts the host on a box with `--stdio`. That host reads the box's own `config.json`, for its plugin options and its model settings.
- `run.ts` stops a `--stdio` host whose options hold `httpApi`, `modelApi` or `routes`, with exit code 2.
- The three keys come from the configuration file only, so a box's file that serves its own daemon stops every host started there.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A `--stdio` host leaves `httpApi`, `modelApi` and `routes` of its file out, with one log line each, and starts | Softov, 2026-11-27, chose "--stdio ignores them" | 01 |
| The log line names the key and says that `--stdio` serves no port | (defaulted: a person who runs `ahpd --stdio` by hand sees why the key does nothing) | 01 |
| The keys are left out before the credential check, so a `--stdio` host with no token is not stopped for them either | (defaulted: the check is for a listener, and none is opened) | 01 |
| The docs of the box and of `--stdio` say so | (defaulted: the docs say what the box host reads) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - the-listener-keys-are-left-out](task-01-the-listener-keys-are-left-out.md) | done | - |

## Risks and tradeoffs

- A person who runs `ahpd --stdio` by hand with `httpApi` set gets a log line, where the host stopped before.

## Resume state

- **Done so far:** task 01, on 2026-11-27. [implemented.md](implemented.md) holds the checks.
- **Next action:** Softov's review.
- **Open questions:** none.
- **Watch out for:** `mcpTools` needs `httpApi`, so check that nothing stops a `--stdio` host for `mcpTools` once `httpApi` is left out.

## Final verification checklist

- [x] A `--stdio` host with `httpApi`, `modelApi` and `routes` in its file starts, and logs a line for each.
- [ ] The server suite passes, and `check-windows` passes.
