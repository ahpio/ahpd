---
title: Check that the computer plugin shows no sandbox schema warning
plans:
  - plans/container/20261115-1915-the-sandbox-schema-names-every-value/plan.md
---

# Check that the computer plugin shows no sandbox schema warning

The computer plugin gave five `root config sandbox ...: object with no properties` warnings at each start. The fix is in `/github/ahpd.worktrees/sandbox-schema-gaps`, on branch `computer/sandbox-schema-gaps`, not committed yet.

## Set up

1. Stop your dev daemon with Ctrl+C in its terminal.
2. Start it from the fix worktree, in that terminal. `config-dev.json` loads `./packages/computer/src/index.ts` from the folder you start in.

```bash
cd /github/ahpd.worktrees/sandbox-schema-gaps
node --conditions development --import ./scripts/dev.mjs packages/server/src/main.ts --config-file /home/softov/.config/ahpd/config-dev.json
```

## Checks

1. Open the computer plugin page in ahpw.
   - Pass: *Installation* shows `PATH` under `sandbox-schema-gaps`, and *Alerts* has no `root config sandbox` line.
   - Fail: any of the five warnings is still there.
2. Open the *Agent Sandbox* settings and expand *Linux Sandbox Filesystem*.
   - Pass: four list fields show: *Allow Read*, *Allow Write*, *Deny Read*, *Deny Write*.
   - Fail: "No parameters defined." or `[object Object]`.
3. Expand *Masked environment variables*, then *Environment Variables*.
   - Pass: you can add a variable name, and each entry has an *Injection Hosts* list.
   - Fail: "No parameters defined."
4. Expand *Advanced Sandbox Runtime*.
   - Pass: you can add a key, and its value is a JSON text box.
   - Fail: "No parameters defined."
5. Set a value in step 2, restart the daemon, and open the settings again.
   - Pass: the value is still there.
   - Fail: the value is gone.

## After

Start your dev daemon from the folder you used before, so it loads its own plugins again.
