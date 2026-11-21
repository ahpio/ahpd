---
title: A machine operation reads its record once
created: 2026-11-21
refs:
  - git://406667ee0 - main when the facts were checked
  - "[problems/computer-cases-time-out-on-a-busy-machine.md](../problems/computer-cases-time-out-on-a-busy-machine.md) - the cases this is for, and its fix: start fewer processes in each case"
  - "[code://packages/computer/src/runtime.ts#L2555-L2599](../../packages/computer/src/runtime.ts#L2555-L2599) - `containerOf` and `containerOrFail`, which read the record and keep only the name"
  - "[code://packages/computer/src/runtime.ts#L2530-L2531](../../packages/computer/src/runtime.ts#L2530-L2531) - `recordOf`, one `docker inspect`"
  - "[code://packages/computer/src/runtime.ts#L2750-L2762](../../packages/computer/src/runtime.ts#L2750-L2762) - `bringBackOfMachine`, which locates and reads the machine again"
  - "[code://packages/computer/src/runtime.ts#L3567-L3600](../../packages/computer/src/runtime.ts#L3567-L3600) - `remove`"
---

# A machine operation reads its record once

Softov chose on 2026-11-21 to cut the docker calls the computer runtime repeats, so each case of the computer suite starts fewer processes. Each docker call is a process, for a real Docker as for the suite's scripted one. A case with a few connects passes 5 s on a busy machine, and each such file has a 20 s budget as a workaround. The goal is each operation calling docker once for each fact it needs.

## What others do

Docker's own CLI reads a container once per command. VS Code's dev container support is not a reference here: it reads through `@devcontainers/cli`, not one `docker inspect` per step.

## What ahpd has today

One disposable machine, made, left and removed in `computer-disposable.test.ts`, takes 25 docker calls. They were recorded by the scripted docker at `406667ee0`:

| Calls | What |
| --- | --- |
| 0-7 | `ps`, `info`, `run`, and 5 `exec` that set up the machine's git |
| 8-9 | `inspect` twice |
| 10 | `volume ls` |
| 11-13 | `git for-each-ref`, `symbolic-ref`, `rev-parse`: the leave reads what the machine committed |
| 14-19 | `inspect` six times in a row |
| 20-22 | the same three git reads again, in the removal |
| 23-24 | `rm -f`, `volume rm` |

Facts behind the repeats:

- `containerOf` reads the record with `recordOf` to find whose the container is, and answers only the name. A caller that needs the record reads it again with `recordOf`.
- `remove` calls `containerOrFail` and `recordOf`: two reads. It then calls `bringBackOfMachine`, which calls `containerOf` and `recordOf`: two more. That is four of the six; the other two are not traced yet.
- `followOfMachine` has the same pair.
- 13 calls in `runtime.ts` go through `containerOf` or `containerOrFail`.
- The removal brings back what the machine committed a second time, after the leave did. Whether work can land in the machine between the two is not checked yet.

## Who writes

- Branch `test/random-cases-get-their-time` changes the waits of `computer-disposable.test.ts`, two server tests and `tools/wait.ts`, and no runtime code.
- No other branch or session writes `packages/computer/src/runtime.ts` now.

## The change

- `containerOf` answers the name and the record it read, and every caller uses that record in place of a second `recordOf`.
- `bringBackOfMachine` and `followOfMachine` take the record their caller already holds.
- A test counts the docker calls of a removal, so a repeat that comes back fails.
- The second bring-back in the removal stays until the plan checks what can run between the leave and the removal.
