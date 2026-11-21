---
title: Check the vscode/* methods and chat changesets of the VS Code main parity
plans:
  - plans/host/20261121-1218-worktree-removals-are-a-queue/plan.md
  - plans/host/20261121-1553-turn-changesets-under-the-chat/plan.md
  - plans/host/20261121-1907-a-client-measures-a-worktrees-disk-usage/plan.md
  - plans/host/20261121-1907-a-single-chat-session-moves-under-another/plan.md
---

# Check the vscode/* methods and chat changesets of the VS Code main parity

These are the `vscode/*` methods and chat changesets built on 2026-11-21, in #418, #419, #428 and #429. The window makes the sessions, and `rpc` asks the host each method.

## Set up

1. Start the test daemon in a new shell:

   ```bash
   source <(git -C /github/ahpd fetch -q origin && git -C /github/ahpd show origin/main:.project/pending/test-daemon.sh) agent-claude
   ```

2. Add the entry the script prints to `chat.remoteAgentHosts` in VS Code's `settings.json`, set `"chat.remoteAgentHostsEnabled": true`, and reload the window.
3. In the same shell, set the two names the steps use:

   ```bash
   W="file://$HOME/ahpd-check/work"
   T="$HOME/ahpd-check/work.worktrees"
   ```

4. Turn chat moves on:

   ```bash
   rpc dispatchAction '{"channel":"ahp-root://","clientSeq":1,"action":{"type":"root/configChanged","config":{"chatMoves.enabled":true}}}'
   ```

   Pass: `ANSWER` with no `error`.

## 1. A worktree's disk usage (#428)

1. Run `rpc vscode/measureWorktreeDiskUsage "{\"uri\":\"$W\",\"requestId\":\"one\"}"`.
   Pass: `ANSWER {"sizeBytes":<n>}`, with `<n>` a little below what `du -s -B1 ~/ahpd-check/work` prints. `du` also counts the folders themselves.
2. Run `rpc vscode/measureWorktreeDiskUsage '{"uri":"ahp-session:/x","requestId":"two"}'`.
   Pass: an `error` with the message `uri must be an absolute file URI`.
3. Run `rpc vscode/measureWorktreeDiskUsage "{\"uri\":\"$W/no-such-folder\",\"requestId\":\"three\"}"`.
   Pass: `ANSWER {}`.

## 2. An archived session's worktree cleanup (#418)

1. In the window, start a Claude session on `ahpd-check` in `work`, with isolation set to "worktree".
2. Send: `Create the file note.txt with the word hello, and do not commit it.` Wait for the turn to end.
3. Archive the session in the window.
4. Run `rpc listSessions '{}'`, and copy the session's `resource` into `S`: `S='<resource>'`.
5. Run `rpc vscode/sessionWorktreeCleanup "{\"session\":\"$S\"}"`.
   Pass: `ANSWER {"state":"skipped","message":"it has changes nobody committed"}`.
   `{"state":"inUse"}` means the host still runs the session: write it down, close the session in the window, and run the step again.
6. Run `rpc vscode/sessionWorktreeCleanup "{\"session\":\"$S\",\"force\":true}"`.
   Pass: an `error` with the message `Forced cleanup requires an explicit retry.`
7. Run `rpc vscode/sessionWorktreeCleanup "{\"session\":\"$S\",\"retry\":true,\"force\":true}"`.
   Pass: `ANSWER {"state":"unknown"}`, and `ls "$T"` no longer lists the session's tree.
8. Run `git -C ~/ahpd-check/work branch --list 'agents/*'`.
   Pass: the session's branch is still listed.

## 3. Managed worktrees (#418)

1. Make a worktree no session holds:

   ```bash
   git -C ~/ahpd-check/work worktree add -q -b agents/orphan "$T/orphan"
   ```

2. Run `rpc vscode/listManagedWorktrees "{\"repositories\":[\"$W\"]}"`.
   Pass: an entry with `"branch":"agents/orphan"` and `"cleanupStatus":{"state":"unknown"}`.
3. Run `rpc vscode/cleanupManagedWorktree "{\"repository\":\"$W\",\"worktree\":\"file://$T/orphan\",\"branch\":\"agents/orphan\",\"force\":true}"`.
   Pass: `ANSWER {}`, `ls "$T"` no longer lists `orphan`, and `git -C ~/ahpd-check/work branch --list agents/orphan` still lists the branch.

## 4. A session moves under another (#429)

1. In the window, start two Claude sessions on `ahpd-check` in `work`, and send `Say hello.` in each. Wait for both turns to end, and keep both open: the host moves only a session it runs.
2. Run `rpc listSessions '{}'`, and copy the two `resource` values: `A='<first>'` and `B='<second>'`.
3. Run `rpc subscribe "{\"channel\":\"$A\"}"`.
   Pass: the answer's `_meta` has `"vscode.movable":true`.
4. Run `rpc vscode/moveSession "{\"session\":\"$A\",\"destination\":\"$A\",\"after\":null}"`.
   Pass: an `error` with the message `A session can't move under itself.`
5. Run `rpc vscode/moveSession "{\"session\":\"$A\",\"destination\":\"$B\",\"after\":null}"`.
   Pass: `ANSWER {"session":"<B>"}`.
6. In the window, check that session A is gone from the list.
   Pass: session B shows A's chat as a second chat, with A's turn in it.

## 5. A chat's own changesets (#419)

1. In session B of section 4, open the chat that moved in from A, and send: `Create the file moved.txt with the word hi.` Wait for the turn to end.
2. Run `rpc listSessions '{}'`, then run `rpc subscribe "{\"channel\":\"$B\"}"`, and copy the moved chat's `resource` from its `chats` into `C`: `C='<chat>'`.
3. Run `rpc subscribe "{\"channel\":\"$C\"}"`.
   Pass: its `changesets` list `uriTemplate` values that start with the chat's own URI, ending in `/changeset/uncommitted` and `/changeset/turn/{turnId}`, and none ending in `/changeset/session`.
4. In the window, open the moved chat's changes.
   Pass: the change picker offers "This Turn", and it shows `moved.txt`.

## Reply

Write "pass" for each section, or what you saw. Stop the test daemon with `ahpd stop`.
