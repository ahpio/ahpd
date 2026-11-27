---
title: The first create makes its machine
status: todo
depends: [task-01-a-create-checks-its-machine.md]
layer: "computer"
---

## Objective

The first create of a Docker machine on a host with no part image makes its machine.

## Files

- `UPDATE: packages/computer/src/plugin.ts:1302-1333` - where the cause is, if it is in the part build.
- `UPDATE: packages/computer/src/runtime.ts` - where the cause is, if it is in the container's start.
- `UPDATE: packages/computer/test/computer.test.ts` - a case for the cause found.

## Steps

1. Start a test daemon with its own XDG folders and port, on the released packages.
2. Use a Docker with no `ahpd-part/ahpd` image, such as a Docker of its own for this run.
3. Create a Docker machine with a cofold profile, and read what task 01 says.
4. Find the cause from that sentence and from the daemon log.
5. Fix the cause where it is, and write a case for it.
6. Create the machine again on a Docker with no part image, and see that it is there.

## Validation

- The first create on a Docker with no part image makes its machine.
- The case for the cause passes, and the computer suite passes.

## Resume
