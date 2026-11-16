---
title: Find why a Claude session from VS Code has no owner
problems:
  - problems/a-claude-session-from-vs-code-has-no-owner.md
---

# Find why a Claude session from VS Code has no owner

A Claude session that VS Code makes on a host with users is saved with no `owner`, and no path for it is known. This check records every frame while you make one, so the path shows in the log.

## Set up

Run this in a terminal of your own. It restarts the test daemon on port 39200 with a wire log, and never touches your own daemon:

```bash
git -C /github/ahpd fetch -q origin && git -C /github/ahpd show origin/main:.project/pending/claude-session-owner-check.sh | bash
```

It prints a `chat.remoteAgentHosts` entry. Its `connectionToken` is the contents of `~/ahpd-check/alice.token`, alice being an admin of the test daemon.

## Check by hand

1. Add the printed entry to VS Code's `chat.remoteAgentHosts`, and reload the window.
2. In the Chat view, pick the host `ahpd-check` and the agent Claude.
3. Start a new session, and send `say hi` once.
4. Wait for the answer, then close the session's editor.

## Reply

Write "done". The log is in `~/ahpd-check/wire.jsonl`, and the session's record in `~/ahpd-check/config/ahpd/sessions/`. I read both, and write the cause into the problem file.
