---
title: A damaged session file is shown, not dropped
created: 2026-11-25
refs:
  - git://2b164c19fd8a5e9856ce4846077b26547b23a652 - the commit of this repository the facts were checked at
  - https://github.com/ahpio/ahpd/issues/471 - the report, by beorn
  - https://github.com/ahpio/ahpd/compare/main...beorn:ahpd:upstream/38201-unreadable-rows - the branch linked from the report, read at 6683139e6
  - "[code://packages/sdk/src/sessions/sessions.ts#L830-L870](../../packages/sdk/src/sessions/sessions.ts#L830-L870) - `setAside` and `load`: a file that is not read is moved aside and its id is not kept"
  - "[code://packages/sdk/src/sessions/sessions.ts#L816](../../packages/sdk/src/sessions/sessions.ts#L816) - `touched`, which every setter but `moveChat` goes through"
  - "[code://packages/sdk/src/sessions/sessions.ts#L1095-L1112](../../packages/sdk/src/sessions/sessions.ts#L1095-L1112) - `forget` and `prune`, which remove the file"
  - "[code://packages/sdk/src/host/catalogue.ts#L1626](../../packages/sdk/src/host/catalogue.ts#L1626) - a row with no provider recorded is external"
  - "[code://packages/sdk/src/host/catalogue.ts#L1634](../../packages/sdk/src/host/catalogue.ts#L1634) - the archived bit of a listed row is read from the store"
  - "[code://packages/sdk/src/host/catalogue.ts#L1771-L1786](../../packages/sdk/src/host/catalogue.ts#L1771-L1786) - `shouldIncludeSession` filters external rows by `showExternalSessions`"
  - "[code://packages/sdk/src/host/catalogue.ts#L1275-L1285](../../packages/sdk/src/host/catalogue.ts#L1275-L1285) - the listing reads each id of `kept.sessions()`"
  - "[code://packages/sdk/src/host/chatrecord.ts#L137-L140](../../packages/sdk/src/host/chatrecord.ts#L137-L140) - the host reads each id of `kept.sessions()` as it is built"
  - "[code://packages/sdk/src/host/lifecycle.ts#L775-L823](../../packages/sdk/src/host/lifecycle.ts#L775-L823) - `mayDispose` and the start of `removeSession`"
  - "[code://packages/sdk/src/utils/jsonfile.ts#L101-L112](../../packages/sdk/src/utils/jsonfile.ts#L101-L112) - `writeJsonAtomic` writes beside the file and renames over it"
  - "[code://packages/server/src/commands/run.ts#L206-L209](../../packages/server/src/commands/run.ts#L206-L209) - the daemon's store, whose `onProblem` is the only notice"
  - "[plan://host/20261104-1505-an-unreadable-session-file-is-kept](../plans/host/20261104-1505-an-unreadable-session-file-is-kept/plan.md) - the plan that chose to move the file aside"
  - https://github.com/microsoft/vscode/blob/1564f100807a84771bfb1a9886fff6eeaca6b147/src/vs/platform/agentHost/node/sessionDataService.ts#L132-L145 - `tryOpenDatabase`, checked at 1564f100
  - https://github.com/microsoft/vscode/blob/1564f100807a84771bfb1a9886fff6eeaca6b147/src/vs/platform/agentHost/node/agentService.ts#L4100-L4105 - the archived bit from the central record, checked at 1564f100
---

# A damaged session file is shown, not dropped

A session whose ahpd file cannot be read must not be treated as a session that does not exist.
A person sees it, and can delete it if they want to, as Softov asked on 2026-11-25.
Issue 471 reports two problems with one cause, and this brief covers both.

1. An unreadable session row is served as absent.
2. An archived session can come back as active.

ahpd's file is one of two parts of a session. The agent keeps the conversation in its own store.
ahpd's file, `sessions/<id>.json`, holds the owner, the agent, the title, the archived bit, the config with the machine, the folder and the worktree.
Here that file is there and cannot be read. It is not missing.

## What others do

VS Code answers "no database" only when the file is not found. Any other failure is thrown ([`tryOpenDatabase`](https://github.com/microsoft/vscode/blob/1564f100807a84771bfb1a9886fff6eeaca6b147/src/vs/platform/agentHost/node/sessionDataService.ts#L132-L145)).
Where a session has no database of its own, VS Code reads the archived bit from a second record in its central database ([`agentService.ts`](https://github.com/microsoft/vscode/blob/1564f100807a84771bfb1a9886fff6eeaca6b147/src/vs/platform/agentHost/node/agentService.ts#L4100-L4105)).
What VS Code does with a database that opens and is corrupt was not checked.

## What ahpd has today

- `load` moves a file it cannot read to `<file>.unreadable-<time>`, and does not keep its id ([`code://packages/sdk/src/sessions/sessions.ts#L830-L870`](../../packages/sdk/src/sessions/sessions.ts#L830-L870)).
- The only notice is `onProblem` ([`code://packages/server/src/commands/run.ts#L206-L209`](../../packages/server/src/commands/run.ts#L206-L209)). No client is told.
- The id then reads as a session that ahpd never made. It has no provider, so it is external ([`code://packages/sdk/src/host/catalogue.ts#L1626`](../../packages/sdk/src/host/catalogue.ts#L1626)). Its flags are 0, so it is not archived ([`code://packages/sdk/src/host/catalogue.ts#L1634`](../../packages/sdk/src/host/catalogue.ts#L1634)).

Both problems were run on main, with one archived session that its agent lists:

| Its file | `showExternalSessions` | `listSessions` |
|---|---|---|
| readable | `none` | `claude:/a`, archived |
| readable | `last30Days` | `claude:/a`, archived |
| not JSON | `none` | nothing (problem 1) |
| not JSON | `last30Days` | `ahp-session:/a`, active (problem 2) |

- The report says that a later write replaces the bytes. On main the file is moved first, so that happens only where the move fails.
- A file that holds only `null` makes `fileSessions` throw a `TypeError`, because `load` reads `version` of it. This was run. `daemonSessions` does not catch it.
- A file whose `id` is not the one in its name is read, under the `id` that it holds.
- A file that could not be read once, for example for a permission, is moved aside too, and is not read at a later start.
- A folder that cannot be read starts an empty store, and nothing is said.
- `writeJsonAtomic` renames a whole file into place, so a process killed during a write leaves the last good file ([`code://packages/sdk/src/utils/jsonfile.ts#L101-L112`](../../packages/sdk/src/utils/jsonfile.ts#L101-L112)).

### Why beorn's branch is not taken as it is

The branch keeps the file in place, and makes each read of a damaged id throw.

- The host does not start. The branch adds the damaged id to `sessions()`, and the host reads each one as it is built ([`code://packages/sdk/src/host/chatrecord.ts#L137-L140`](../../packages/sdk/src/host/chatrecord.ts#L137-L140)). One damaged file beside a good one was run: `createHost` throws.
- The listing reads each id in the same way ([`code://packages/sdk/src/host/catalogue.ts#L1275-L1285`](../../packages/sdk/src/host/catalogue.ts#L1275-L1285)). The branch changes no caller.
- `forget` and `prune` delete the damaged file. Both were run on the store.
- Its tests cover the store alone.

Its stricter row check is right: an object, of version 1, whose `id` is the one in the file name. Its test rows can be reused. beorn gets the credit.

## Who writes

| Writer | What the change does to it |
|---|---|
| beorn's branch, not a pull request | It changes `sessions.ts` and its test only. Both replace the same part of `load` |

There was no open pull request on 2026-11-25.
No unmerged branch of `ahpio/ahpd` and no worktree of this clone changes `sessions.ts`, `catalogue.ts`, `snapshots.ts`, `chatactions.ts`, `lifecycle.ts` or `types/sessions.ts`.
Forks other than beorn's were not checked.

## The change

- The store keeps the id of a damaged file, with the reason, apart from the ids that it can read. A read of that id does not throw, so no caller breaks.
- One damaged file never stops the host, the listing or another session.
- The host lists a damaged id as a failed session, with a short reason, whatever `showExternalSessions` says. This fixes problem 1.
- A damaged id is never listed as an ordinary session, and never as external. This fixes problem 2.
- Nothing writes over a damaged file. A write for its id is not made, and is logged.
- Nothing automatic removes it: the prune leaves it.
- A person can delete the session, which removes the file. Deleting reads the owner from the store ([`code://packages/sdk/src/host/lifecycle.ts#L775-L823`](../../packages/sdk/src/host/lifecycle.ts#L775-L823)), and a damaged file has none.
- `load` accepts a row that is an object, of version 1, whose `id` is the one in its file name. `null` is a damaged row, and not a crash.
- A folder that cannot be read still starts an empty store, as Softov chose on 2026-11-25.
- Each of the two problems has a test through a real host, with the four rows of the table above. `null`, a delete and a prune have one each.

The archived bit is in the damaged file, so the failed row cannot say whether the session was archived.

## Open points

- The file stays in place, or is still moved aside. Softov chose to move it aside on 2026-11-04, in the plan in the refs. In place, a file that becomes readable is a normal session at the next start. Moved aside, the store has to find the id from the moved name.
- What a person can do with a damaged session besides deleting it. Softov asked whether one can interact with it, since the agent still has the conversation, and has not chosen:
  - A: nothing but delete.
  - B: also an action to recover it, which starts it over with default settings because the person chose to.
  - C: it goes on by itself, as it can today, and the person is told. A session whose config names a machine then loses that name, and nothing says that it ran in one.
- What opening it shows. The protocol has `lifecycle: 'failed'` with `creationError`, and ahpw draws that as an alert. Its other actions (send, rename, archive, config) were not traced in the code.
- Who can delete it on a host with several people. From `mayDispose`, a signed-in person needs `session:*`, because no owner can be read.
- Which agent's copy of the conversation a delete removes, where no agent can be read from the file.
- The `provider` of the failed row, which the protocol's summary requires.
- Whether the archived bit is kept in a second place, as VS Code does.
- Whether the empty start of an unreadable folder gets a log line.
