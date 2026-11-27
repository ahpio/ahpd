---
title: A create answers only with its machine - implemented
---

## What exists now

- `create` checks the machine's name inside the per-runtime queue, so a second create of one name waits and is refused with `-32010`.
- `create` reads the machine back by the id its run answered. A machine that is gone fails the create with `-32603` and what `eventsOf` says, or with `<name> was made and is gone, and docker has nothing on it`.
- `eventsOf` is a new optional method of a runtime. Docker answers it from `docker events` since the create began, and the router passes it on.
- The Docker run's guard removes nothing when Docker refused the run because the name is taken: that container is another create's machine.
- `rpc.mjs` answers a request of the host, such as `ping`, as a method it does not serve, and sends its own request once.

## Verified

- `computer.test.ts`: a create whose machine is gone fails with the runtime's events, or with the sentence for none.
- `computer.test.ts`: two creates of one name make one machine, and the second is refused.
- `computer-cleanup.test.ts`: a run refused for a taken name leaves that machine, and runs no `docker rm`.
- The computer suite passes 700 cases, and `pnpm typecheck` passes.
- With real Docker, a host built from the branch got two creates of `rc2box` at once. It answered `{}` and `-32010`, and `rc2box` stayed up for a minute.
- The cause was traced on a scratch install of `0.16.0-rc.1`: the second run's `Conflict`, then its `docker rm -f` of the first one's machine.

## Departures from the plan

- Task 01 reads the events of a gone machine, not its state and log: a container that is gone has neither.
- The fixture `docker.mjs` refuses a make of a taken name, as Docker does.
- `computer-needs.test.ts` expects the `inspect` that reads the machine back after its start.
