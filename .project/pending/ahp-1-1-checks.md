---
title: Check the rest of AHP 1.1.0 with a script
plans:
  - plans/host/20261124-0923-the-small-wire-items-of-ahp-1-1-0/plan.md
  - plans/host/20261124-0942-a-changeset-file-says-it-is-being-edited/plan.md
  - plans/host/20261124-0930-a-reasoning-part-says-how-long-it-took/plan.md
  - plans/host/20261124-0944-a-chat-runs-on-an-agent-of-its-own/plan.md
  - plans/host/20261124-0945-a-moved-chat-says-where-it-went/plan.md
  - plans/claude/20261124-0943-an-mcp-servers-skills-show-and-load/plan.md
---

# Check the rest of AHP 1.1.0 with a script

A script asks the test daemon for each of the six plans of 2026-11-24, and prints `PASS` or `FAIL` per line.

Not here: `accountId`, `resultMetadata`, cofold's and pi's restored reasoning times, and what a window draws. Their test cases cover the first three.

The skills lines fail until the branch `claude/20261124-2230-a-connecting-mcp-server-is-asked-again` is merged.

## 1. Set up

Run this in a new shell. It stops a test daemon that runs, and starts one from `origin/main`.

```bash
source <(git -C /github/ahpd fetch -q origin && git -C /github/ahpd show origin/main:.project/pending/test-daemon.sh) agent-claude .project/pending/ahp-1-1-plugin/plugin.json
C=$AHPD_CHECK/.project/pending/ahp-1-1-checks.mjs
```

Pass: the last lines say `Test daemon on ws://127.0.0.1:39200`.

## 2. Without a model

```bash
node $C free
```

Pass: 20 `PASS` lines, and `All passed.` at the end.

Fail: a `FAIL` line, with what the daemon answered under it.

## 3. With Claude

It runs six short turns on Sonnet, and takes about a minute. It makes the folder `~/ahpd-check/work/ahp-1-1`.

```bash
node $C claude
```

Pass: 8 `PASS` lines, and `All passed.` at the end.

A `SKIP` line says that the model did not think. Run it again with `AHPD_MODEL=opus node $C claude`.

## 4. After a restart

```bash
ahpd stop
ahpd start --port 39200 --connection-token-file ~/ahpd-check/token
node $C restart
```

Pass: 4 `PASS` lines, and `All passed.` at the end.

Fail: the moved chat is not in its new session, or it has lost its turn or its reasoning times.

## 5. Stop

```bash
ahpd stop
```

Close the shell. When every section passes, the six plans can be `built`.
