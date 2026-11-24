---
title: A client's tool call asks, runs once and answers
plans:
  - plans/host/20261124-2223-a-client-runs-a-call-the-agent-started/plan.md
---

# A client's tool call asks, runs once and answers

1. Run the daemon with the change, and open ahpw from its branch `sessions/20261123-1358-ahpw-serves-its-commands-as-tools`.
2. Open a Claude session with approvals on "Ask Before Edits". Set "Open file" to "Notify" in the Tools panel.
3. Send: "List the ahpw commands, then use one to open README.md from this folder."
4. Pass: a question shows for `listCommands` before it has an output. Fail: the call is complete with no question.
5. Allow it. Pass: it runs once, and the agent goes on to `runCommand`. Fail: the turn stays running.
6. Deny `runCommand`. Pass: no file opens and the agent replies. Fail: the file opens.

## Reply

- Write pass, or the step that failed.
