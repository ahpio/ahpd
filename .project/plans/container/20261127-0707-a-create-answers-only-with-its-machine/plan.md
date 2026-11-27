---
title: A create answers only with its machine
domain: container
status: active
priority: medium
created: 2026-11-27
revalidated: 2026-11-27
refs:
  - git://df65c4987 - main when the plan was made, and the last commit that holds the problem file `a-machines-first-create-makes-no-machine.md`
  - "[code://packages/computer/src/provider.ts#L298-L348](../../../../packages/computer/src/provider.ts#L298-L348) - `create`, which answers once `runtime.run` returns"
  - "[code://packages/computer/src/plugin.ts#L1302-L1333](../../../../packages/computer/src/plugin.ts#L1302-L1333) - `run`, which builds the parts before it makes the machine"
  - "[code://packages/computer/src/runtime.ts#L3551-L3554](../../../../packages/computer/src/runtime.ts#L3551-L3554) - the `docker run -d` or `docker create` that makes the container"
  - "[code://packages/computer/test/computer.test.ts](../../../../packages/computer/test/computer.test.ts) - the create cases over a scripted Docker"
---

## Goal

A create that answers done has made its machine. On 2026-11-27, the first create of a Docker machine on a host with no part image answered `{}`. It made no machine, and the log said nothing.

## Reconnaissance

- `create` waits for `runtime.run`, which waits for `ensureParts` and then for `docker run -d`.
- A failure there would answer with an error, so the `{}` came from a run that returned while the container did not stay.
- The second create of the same body, once the part image was there, made the machine in 1.4 s.
- The client was `rpc.mjs`, which closes its connection once it has the answer.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A create checks that its machine exists before it answers | Softov, 2026-11-27, chose "Check, then find the cause" | 01 |
| A machine that is not there fails the create with Docker's own words on the container: its state, its exit code and the end of its log | Softov, 2026-11-27, chose "Check, then find the cause" | 01 |
| The cause is reproduced on a Docker with no part image, and fixed where it is found | Softov, 2026-11-27, chose "Check, then find the cause" | 02 |
| A container gone with no trace fails with that sentence, since Docker has nothing to say of it | (defaulted: the create must still say why it failed) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - a-create-checks-its-machine](task-01-a-create-checks-its-machine.md) | done | - |
| [02 - the-first-create-makes-its-machine](task-02-the-first-create-makes-its-machine.md) | done | 01 |

## Risks and tradeoffs

- The check adds one `docker inspect` to every create.
- Task 02 may find the cause outside the create, such as in the part volume sweep. Its fix then goes where the cause is.

## Resume state

- **Done so far:** both tasks, on 2026-11-27. [implemented.md](implemented.md) holds the checks.
- **Next action:** Softov's review.
- **Open questions:** none.
- **Watch out for:** Softov's daemon shares this Docker. Remove only the images, volumes and machines this run made, or run the repro on a Docker of its own.

## Final verification checklist

- [x] A create whose container does not stay fails, with what Docker says of it.
- [x] A first create on a Docker with no part image makes its machine.
- [ ] The computer suite passes, and `check-windows` passes.
