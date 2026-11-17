---
title: A Claude session from VS Code has no owner, so the owner's command check never applies
status: open
date: 2026-10-20
severity: major
refs:
  - "[code://packages/sdk/src/host/spawn.ts#L932-L933](../../packages/sdk/src/host/spawn.ts#L932-L933) - `getAutoApproval` gives no answer when the sender is not the session's owner"
  - "[code://packages/sdk/src/host/sessionmethods.ts#L1013](../../packages/sdk/src/host/sessionmethods.ts#L1013) - `createSession` passes the connection's owner to `openSession`"
  - "[code://packages/sdk/src/host/lifecycle.ts#L1622](../../packages/sdk/src/host/lifecycle.ts#L1622) - `openSession` writes the owner"
  - "[code://packages/sdk/src/host/owners.ts#L206](../../packages/sdk/src/host/owners.ts#L206) - the scope, which `createSession` also always writes"
  - "[code://packages/sdk/src/host/spawn.ts#L560](../../packages/sdk/src/host/spawn.ts#L560) - `keepProvider`, which writes a record for any session that starts"
  - "[code://packages/sdk/src/host/lifecycle.ts#L2261](../../packages/sdk/src/host/lifecycle.ts#L2261) - a person's turn adopts an external session, and writes no owner"
  - "[code://packages/sdk/src/host/catalogue.ts#L1838-L1849](../../packages/sdk/src/host/catalogue.ts#L1838-L1849) - `adoptExternalSession`"
---

## Symptom

Softov's daemon runs with a `users` file and the `vscode` terminal defaults.
In a Claude session from VS Code in Ask Before Edits mode, `pnpm ls --depth 0` asks.
The `vscode` defaults approve that command, so it must run with no question.

The session records show why.
Five Claude sessions from VS Code on 2026-10-20 have no `owner`, no `scope` and no `pullRequests` in `<configDir>/sessions/<id>.json`: `2960f170`, `8f45ce8a`, `878eff2e`, `4e69d1e3` and `df5495f4`.
Each has turns, a provider and senders `root:soft-sandbox`.
The pi session `5e8fcdfc` from the same VS Code on the same day has all three fields.

On 2026-11-17, Softov ran the check of `pending/claude-session-owner-checks.md` (git://9c3477986) on the test daemon at `2228ec5af`.
VS Code sent `createSession` for `87531150`, and the record has `owner: "user:alice"`.
Every `session/metaChanged` of it says `ahpd.owner: "user:alice"`.
So a new Claude session from VS Code gets its owner.

The same log lists 22 Claude sessions with `vscode.external: true`, because the test root sets `showExternalSessions: "last24Hours"`.
They are the Claude Code sessions of the host's account, read from its transcripts.

## Cause

Partly known.

A person's turn on an external session adopts it, as VS Code's host does.
`adoptExternalSession` makes it the host's own session, and no code on that path writes an owner.

A test proved it on 2026-11-17, at `25654afe8`, in `/github/ahpd.worktrees/external-owner` and not committed.
On a host with users, ana signs in, makes a session with `createSession`, and sends a turn on an external session.
The session she made is kept with the owner `user:ana`.
The external session she adopted is kept with no owner.

The five ids of 2026-10-20 each have a folder in `~/.claude/session-env/` dated 2026-10-20.
Claude Code makes that folder for any session it runs, so that does not prove they were external.
Their records and transcripts are gone, so other paths are not ruled out for them.
With a `users` file, `getAutoApproval` approves only when the sender owns the session.
A session with no owner never matches, so every command asks.

`createSession` always writes the owner, the scope and the pull request baseline.
A record with none of them was written by a path other than `createSession`.
That path is not found yet.

What was ruled out, on a second daemon built from `main` at `11f5efa6` with a `users` file:

- `ahpc session new --agent claude` writes the owner `root:soft-sandbox`, and a turn keeps it.
- A disposed session forgets its record, and a turn sent to it does not run.
- The move of a chat to a new session copies the source's owner, and the sources here are not moves.

Two Claude records from VS Code on 2026-10-19, `3717bfcd` and `c05b2d61`, have the owner and no turns, and Claude has no transcript for them.
VS Code makes a provisional session before the first message, so these are likely provisionals that never ran.

## Impact

Since 4c3738f08, every turn reads the host's terminal rules whoever sent it, so the command check no longer depends on the owner.
A session from VS Code on a host with users still has no owner.
What else reads a session's owner was not checked again.

## Workaround

None. Approve each command by hand.

## Fix

No fix is chosen.

1. Write the owner of the person whose turn adopts an external session, as `createSession` writes the connection's owner.
2. Write the owner on every other path that makes a record, so a session with no owner is only one that nobody owns.
