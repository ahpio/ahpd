---
title: The cases run a fast shell
status: done
depends: [task-01-the-shell-is-chosen-in-code.md]
layer: "agent-cofold"
---

## Objective

Every agent-cofold case that runs a shell call on Windows runs it through cmd, which starts in milliseconds.

## Files

- `CREATE: packages/agent-cofold/test/support/shell.ts` - `FAST_SHELL`, cmd on Windows and `sh -c` elsewhere.
- `UPDATE: packages/agent-cofold/test/agent-cofold-questions.test.ts` - `open` passes `FAST_SHELL`, and the language case refuses its call on the default shell.
- `UPDATE: packages/agent-cofold/test/agent-cofold-tools.test.ts` - `open` passes `FAST_SHELL`, with a command per platform where cmd differs.
- `UPDATE: packages/agent-cofold/test/agent-cofold-store.test.ts` - `backend` passes `FAST_SHELL`.

## Steps

1. Write `FAST_SHELL` in `test/support/shell.ts`.
2. Pass it from each file's session helper.
3. Give the language case the default shell, and refuse its call.
4. Replace each command that cmd does not run, such as `pwd` and `true`, on Windows.

## Validation

- `pnpm vitest run` in `packages/agent-cofold` passes on Linux.
- `check-windows` passes on the PR.

## Resume

Built on 2026-11-26. In the tools file, `pwd` is `cd` on Windows, and the mode table's `true` is `echo hi`.
