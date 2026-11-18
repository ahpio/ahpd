---
title: Configure sets up policies and people
created: 2026-11-17
refs:
  - git://e0f8f696a - the commit of ahpd the facts were checked at
  - "[code://packages/server/src/commands/configure.ts#L227-L452](../../packages/server/src/commands/configure.ts#L227-L452) - `configure`, the questions and the end of the run"
  - "[code://packages/server/src/commands/user.ts#L54-L71](../../packages/server/src/commands/user.ts#L54-L71) - `people`, which stops a user command when no `users` file is set"
  - "[code://packages/server/src/commands/user.ts#L150-L196](../../packages/server/src/commands/user.ts#L150-L196) - `user.add`, with `guest` as the role when none is given"
  - "[code://packages/server/src/config.ts#L939](../../packages/server/src/config.ts#L939) - `policiesPath`, the store at `<config dir>/policies.json`"
  - "[code://packages/sdk/src/types/policies.ts#L138](../../packages/sdk/src/types/policies.ts#L138) - `put`, how a row is written to the store"
  - "[code://packages/sdk/src/host/machines.ts#L426-L471](../../packages/sdk/src/host/machines.ts#L426-L471) - `machineFor` and `admitted`: a session is checked for `agent`, then `computer`, and no computer means `host`"
  - "[code://packages/sdk/src/access/decide.ts#L166-L243](../../packages/sdk/src/access/decide.ts#L166-L243) - `matched` and `decide`: an empty match allows nothing, any deny wins, no candidate refuses"
  - "[code://packages/server/src/commands/run.ts#L592-L596](../../packages/server/src/commands/run.ts#L592-L596) - `startingChecks`, the start warning for an empty store with the check on"
  - "[code://docs/sdk/POLICY.md#L94](../../docs/sdk/POLICY.md#L94) - *The switch*, and *What is checked, and where* after it"
  - "[code://.project/briefs/the-policy-check-is-a-server-setting.md](the-policy-check-is-a-server-setting.md) - the brief that puts `policies` in root config, the other writer of `policies.check`"
  - https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/ - `kubeadm init` ends with the commands to run next, page for Kubernetes v1.37
  - https://kubernetes.io/docs/reference/access-authn-authz/rbac/ - the API server creates default ClusterRoles and bindings, and reconciles them at each start
---

# Configure sets up policies and people

Softov wants `ahpd configure` to set up policies and people, so that a first person can start a session without a hand-written policy.
On 2026-11-17 his first session as `soft` was refused with `no policy allows computer host`, because the store held only a `model` row.
He had to learn that a session needs an `agent` row and a `computer` row, and write both by hand.
He also wants `configure` to end with what to do next, and to ask whether to add a person.

## What others do

- `kubeadm init` ends with the commands to run next: copy the admin config, deploy a Pod network, and the `kubeadm join` line for more nodes. The page says "After it finishes you should see:" before the block.
- Kubernetes RBAC ships default roles. Its page says: "API servers create a set of default ClusterRole and ClusterRoleBinding objects."
  At each start, the API server adds what is missing from them.
- ahpd follows kubeadm for the end of the run. The starter rows are like RBAC's defaults, but `configure` writes them once and only on a yes, and the daemon never adds them by itself.

## What ahpd has today

- `configure` asks for the backends, the other plugins, the host, the port, the connection token, the folders and the marketplaces.
- It asks nothing about people or policies, and it ends after it installs the plugins.
- `policies.check` is off by default, and it has no flag. It is set by a hand edit of `config.json` or by `ahpd config set policies`.
- The store is `<config dir>/policies.json`, and `filePolicies(...).put(row)` writes one row.
- The daemon reads the store once, at start, so a row written by `configure` counts from the next start.
- With the check on, a session is checked for `agent` and then for `computer`. A session that names no computer is checked as `computer host`.
- A gateway call by a person is checked for `model`.
- A row whose match names no value type allows nothing. A value type that a row leaves out is not constrained.
- Any matching deny wins over every allow, whatever their scopes.
- The root connection, an automation with no person, and a host with no `users` file are never checked.
- With the check on and an empty store, the daemon says once at start that every session and turn but root's is refused.
- `ahpd user add <id>` gives the role `guest` when no `--role` is given.
- Every `ahpd user` command stops with "No user file" when the configuration sets no `users`.
- `ahpd user token <id>` prints the person's credential, and `--url` prints the whole `ws://` URL.

## Who writes

- No open PR on `ahpio/ahpd` touches `commands/configure.ts`, `commands/user.ts`, `access/policies.ts`, `docs/sdk/POLICY.md` or `docs/server/CONFIGURE.md` at `e0f8f696a`.
- No worktree under `/github/ahpd.worktrees/` changes those files.
- No `maycxc` fork branch changes those files.
- The brief `the-policy-check-is-a-server-setting.md` puts `policies` in root config, so a client can also write `policies.check`. Both write the same key in `config.json`, and neither needs the other.

## The change

- After the questions of today, `configure` asks whether to add a person now.
- A yes asks for the id and the roles, with Enter keeping `guest`, and adds the person as `ahpd user add` does.
- On a host with no `users` file, a yes also sets `users` to `<config dir>/users.json`, since a person needs a file to be kept in.
- Then, on a host with a `users` file, `configure` asks whether to turn the policy checks on, and shows the value the file holds now.
- A yes writes `policies.check: true`, and the question says that a person no policy allows is then refused.
- With the check on, `configure` reads the store and finds each kind among `agent`, `computer` and `model` that has no `all` allow row.
- For those kinds, it asks once whether to write starter rows that allow every person every agent, every computer and every model.
- A yes writes one `all` row per missing kind, with `*` for the kind's own value type and no limits.
- The question names the kinds it would cover, and that a `model` row opens every model to every person.
- Last, `configure` prints the next commands, as `kubeadm init` does: `ahpd user token <id> --url` for each person it added, and how to start the daemon.
- It prints the token command and does not run it, so no credential is printed without a request.
- `docs/server/CONFIGURE.md` and `docs/sdk/POLICY.md` say what `configure` asks and writes.
- `docs/sdk/POLICY.md` also says that a session needs an `agent` row and a `computer` row, and that no computer means `host`.
