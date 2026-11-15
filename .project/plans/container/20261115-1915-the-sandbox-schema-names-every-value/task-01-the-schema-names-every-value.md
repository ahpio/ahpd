---
title: The sandbox schema names every value
status: done
depends: []
layer: "computer"
refs:
  - "[code://packages/computer/src/sandbox.ts#L16-L86](../../../../packages/computer/src/sandbox.ts#L16-L86) - `FILE_SYSTEM_PROPERTIES` and `SANDBOX_PROPERTY`"
  - "[code://packages/sdk/src/types/sandbox.ts#L54-L65](../../../../packages/sdk/src/types/sandbox.ts#L54-L65) - the shapes to name"
---

## Objective

`SANDBOX_PROPERTY` names a value schema for each of its objects, and loading the computer plugin gives no `root config sandbox` warning.

## Files

- `UPDATE: packages/computer/src/sandbox.ts:22-63` - name the values of `credentials.envVars`, the three `fileSystem.*` keys and `advanced.runtime`.

## Steps

1. Give `credentials.envVars` the `additionalProperties` entry and description of VS Code `07225c7a78b1`.
2. Write one `FILE_SYSTEM_PROPERTIES` object with `allowRead`, `allowWrite`, `denyRead` and `denyWrite`, each a list of paths.
3. Use `FILE_SYSTEM_PROPERTIES` as the `properties` of `fileSystem.linux`, `fileSystem.mac` and `fileSystem.windows`.
4. Give `advanced.runtime` the value `additionalProperties: {}`.
5. Cite VS Code `07225c7a78b1` for `envVars` and `SandboxFileSystemSetting` for the filesystem keys in the doc comment.

## Validation

- `schemaGaps(SANDBOX_PROPERTY)` returns an empty list.
- `pnpm vitest run packages/computer/test/computer-sandbox.test.ts` passes.
- `pnpm -s typecheck` passes.

## Resume

`SANDBOX_PROPERTY` names a value schema for every object. `schemaGaps` finds no gap in it, through the gap test of task 02. `computer-sandbox.test.ts` and every test file named for the sandbox pass, 23 cases. `pnpm -s typecheck` passes.
