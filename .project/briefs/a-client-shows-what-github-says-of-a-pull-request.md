---
title: A client shows what GitHub says of a pull request
created: 2026-11-09
refs:
  - git://e471ba827 - the commit of ahpd the facts were checked at
  - git://e471ba827 - the last commit that holds the problem file `a-recorded-pull-request-never-shows-merged.md`, which this brief covers
  - "[code://packages/sdk/src/host/facts.ts#L179](../../packages/sdk/src/host/facts.ts#L179) - `_meta.github` and `_meta.githubData`, the GitHub facts of the session's folder"
  - "[code://packages/sdk/src/host/facts.ts#L598-L670](../../packages/sdk/src/host/facts.ts#L598-L670) - `refreshPullRequests`, which reads the folder's branch only and keeps one state"
  - "[code://packages/sdk/src/host/facts.ts#L614](../../packages/sdk/src/host/facts.ts#L614) - with `autoAttachPullRequests` off, GitHub is not asked; the lists are only trimmed"
  - "[code://packages/sdk/src/host/facts.ts#L711-L714](../../packages/sdk/src/host/facts.ts#L711-L714) - `readFacts`, which runs `refreshPullRequests`"
  - "[code://packages/sdk/src/host/spawn.ts#L1805](../../packages/sdk/src/host/spawn.ts#L1805) - the facts are read at the end of each turn"
  - "[code://packages/sdk/src/host/snapshots.ts#L503](../../packages/sdk/src/host/snapshots.ts#L503) - the facts are read when a client subscribes to a session's changes"
  - "[code://packages/sdk/src/types/github.ts#L6-L15](../../packages/sdk/src/types/github.ts#L6-L15) - `PullRequest`: `url`, `state`, and an optional `title` and `createdAt`"
  - "[code://packages/sdk/src/types/github.ts#L91-L107](../../packages/sdk/src/types/github.ts#L91-L107) - `PullRequestCore`, the agent merge's read of one pull request"
  - "[code://packages/sdk/src/repo/github.ts#L102-L117](../../packages/sdk/src/repo/github.ts#L102-L117) - the lists by branch, over REST and `gh`"
  - "[code://packages/sdk/src/repo/github.ts#L146-L168](../../packages/sdk/src/repo/github.ts#L146-L168) - `byUrl`, which keeps the state and the title only"
  - "[code://packages/sdk/src/repo/github.ts#L276-L294](../../packages/sdk/src/repo/github.ts#L276-L294) - `coreIn`, which reads `pulls/<number>` and keeps the number, state, title, branches and draft"
  - "[code://packages/sdk/src/vscoderootconfig.ts#L269-L274](../../packages/sdk/src/vscoderootconfig.ts#L269-L274) - `autoAttachPullRequests`, on by default"
  - https://github.com/ahpio/ahpw/blob/113d3fe/src/resources/sessions/pull-requests.ts#L65-L131 - ahpw's list of a session's pull requests, with a state for `pullRequestStateUrl` only
  - https://github.com/ahpio/ahpw/blob/113d3fe/src/resources/sessions/PullRequests.tsx#L24-L40 - ahpw's pull request view: link, repository, state and branches
  - https://github.com/microsoft/vscode/blob/6e68549edb69380c9316e49df5d3795d5064a2b0/src/vs/platform/agentHost/node/agentHostPullRequestStatusService.ts#L502-L523 - VS Code's host watches one pull request per folder, for the branch the folder is on
  - https://github.com/microsoft/vscode/blob/6e68549edb69380c9316e49df5d3795d5064a2b0/src/vs/workbench/contrib/sessions/common/github/sessionGitHubReferences.ts#L62-L121 - VS Code's window lists the recorded and the associated pull requests
  - https://github.com/microsoft/vscode/blob/6e68549edb69380c9316e49df5d3795d5064a2b0/src/vs/sessions/contrib/github/browser/github.contribution.ts#L254-L283 - VS Code's window reads each one from GitHub, and polls it while it is open or shown
  - https://github.com/microsoft/vscode/blob/6e68549edb69380c9316e49df5d3795d5064a2b0/src/vs/workbench/contrib/sessions/browser/github/models/githubPullRequestModel.ts#L22 - the poll interval, 60 seconds
  - https://github.com/microsoft/vscode/blob/53dca6e68b336634d16ef109583c6078f31a87f6/src/vs/workbench/contrib/sessions/common/github/types.ts#L81-L97 - `IGitHubPullRequest`, what VS Code's window reads from GitHub
---

# A client shows what GitHub says of a pull request

Softov wants each pull request of a session to carry what GitHub says of it, and a client to show that.
He asked on 2026-11-09, with a screenshot of VS Code's pull request card beside his client's.
He asked again on 2026-11-16: "put the PR information inside the PR and show it".
The card he wants shows the repository, the date, the title and number, the state, the description, `base ← head` and the author.

## Why it is asked again

ahpw built the pull request pill and `/session.pr` on 2026-11-09, in commit `52a2537`, without this information.
Its entries show only what ahpd sends today:

- A pull request the agent recorded shows the label the agent gave it.
  On 2026-11-16, #344 read "(merged, with two commits)", which is the agent's label, not GitHub's title.
- A state shows only for the one URL in `pullRequestStateUrl`.
  A session on `main` merged #349, and #349 kept showing no state, also after a restart of the daemon.
- The branches shown are the session folder's, also for a pull request of another branch.

## What others do

**VS Code's host** watches one pull request per folder, the one for the branch the folder is on ([`agentHostPullRequestStatusService.ts`](https://github.com/microsoft/vscode/blob/6e68549edb69380c9316e49df5d3795d5064a2b0/src/vs/platform/agentHost/node/agentHostPullRequestStatusService.ts#L502-L523)).
It publishes one state, of one URL, and no title, author, description or date.

**VS Code's window** gets the rest:

- It lists the recorded and the associated pull requests of a session ([`sessionGitHubReferences.ts`](https://github.com/microsoft/vscode/blob/6e68549edb69380c9316e49df5d3795d5064a2b0/src/vs/workbench/contrib/sessions/common/github/sessionGitHubReferences.ts#L62-L121)).
- It reads each one from GitHub once, and polls it every 60 seconds while it is open or its session is shown ([`github.contribution.ts`](https://github.com/microsoft/vscode/blob/6e68549edb69380c9316e49df5d3795d5064a2b0/src/vs/sessions/contrib/github/browser/github.contribution.ts#L254-L283)).
- Its model holds `number`, `title`, `body`, `state`, `author`, `headRef`, `baseRef`, `isDraft`, `createdAt`, `updatedAt`, `mergedAt` and `closedAt` ([`types.ts`](https://github.com/microsoft/vscode/blob/53dca6e68b336634d16ef109583c6078f31a87f6/src/vs/workbench/contrib/sessions/common/github/types.ts#L81-L97)).

A client of ahpd has no GitHub account, and ahpd has one: a token a client lent, or `gh`.
So ahpd reads what VS Code's window reads, and a client draws it.

## What ahpd has today

- `refreshPullRequests` asks GitHub about the folder's branch only ([`code://packages/sdk/src/host/facts.ts`](../../packages/sdk/src/host/facts.ts#L598-L670)).
  It reads nothing on the base branch, and keeps one `pullRequestState` with its `pullRequestStateUrl`.
- With `autoAttachPullRequests` off, it asks nothing and only trims the lists ([`code://packages/sdk/src/host/facts.ts`](../../packages/sdk/src/host/facts.ts#L614)).
  The setting is on by default, and Softov's dev daemon has it off.
- The facts are read at these times:
  - at the end of each turn, and after an operation;
  - when a client subscribes to a session's changes;
  - for a listed session with no live process.
  Nothing reads them again on a timer, so a merge made outside a session shows only at the next read.
- `byUrl` keeps the state and the title ([`code://packages/sdk/src/repo/github.ts`](../../packages/sdk/src/repo/github.ts#L146-L168)).
- `coreIn` already reads `pulls/<number>` for the agent merge, and keeps the number, state, title, branches and draft ([`code://packages/sdk/src/repo/github.ts`](../../packages/sdk/src/repo/github.ts#L276-L294)).
  GitHub's answer there also holds `user.login`, `body`, `created_at`, `merged_at` and `closed_at`.
- ahpw reads a state only for `pullRequestStateUrl`, and the branches from the session folder's `_meta.git` ([`pull-requests.ts`](https://github.com/ahpio/ahpw/blob/113d3fe/src/resources/sessions/pull-requests.ts#L65-L131)).

## Who writes

Checked on 2026-11-16:

- No branch of `origin` other than `main` changes `facts.ts`, `repo/github.ts`, `types/github.ts` or `tools/artifacts.ts`.
- No local branch of `/github/ahpd` changes them.
- No pull request is open on `ahpio/ahpd`.

## The change

In ahpd:

- ahpd reads each pull request a session shows by its URL: the branch's, the recorded ones and the associated ones.
- It reads them also with `autoAttachPullRequests` off. A read associates nothing new.
- For each one, it keeps what GitHub says:
  - the number, the repository, the title and the state, with draft;
  - the author's login and the description;
  - the base and the head branch;
  - when it was opened, merged and closed.
- The read reuses `coreIn` over REST, and `gh pr view` with the same fields by name.
- It reads them when the folder's facts are read, as today.
- While a client watches the session, an open pull request is read again every 60 seconds, as VS Code's window polls. A merged or closed one is not read again.
- A read that fails keeps what was held.
- VS Code's fields in `_meta.github` stay as they are.
- (defaulted: the information goes in one entry per pull request, keyed by its URL, under an ahpd key beside `_meta.github`.)
  One place covers the recorded and the associated ones alike.
- (defaulted: the description is sent up to 1000 characters, because `_meta` goes with every session summary.)

In ahpw:

- Each pull request in the pill and in `/session.pr` shows the card.
  The card shows the repository, the date, the title and number, the state, the description, `base ← head` and the author.
- GitHub's title replaces the label the agent gave.
- The branches are the pull request's own.
- The state colours the pill as today, now for each pull request.
