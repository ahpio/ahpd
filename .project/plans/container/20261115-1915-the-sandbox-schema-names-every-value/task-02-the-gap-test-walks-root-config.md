---
title: The gap test walks each root config property a plugin declares
status: done
depends:
  - task-01-the-schema-names-every-value.md
layer: "server"
refs:
  - "[code://packages/server/test/schema-gaps.test.ts#L154-L177](../../../../packages/server/test/schema-gaps.test.ts#L154-L177) - `walkedOf`, which walks no provider configuration"
  - "[code://packages/sdk/src/plugins/plugins.ts#L1722](../../../../packages/sdk/src/plugins/plugins.ts#L1722) - the place name the daemon reports, `root config <key>`"
---

## Objective

The first-party gap test fails when a provider configuration a plugin registers has a gap.

## Files

- `UPDATE: packages/server/test/schema-gaps.test.ts:154-177` - walk each property of each `providerConfigurations` entry.

## Steps

1. In `walkedOf`, add each property of each `contribution.providerConfigurations` entry as `root config <key>`.

## Validation

- With the old `SANDBOX_PROPERTY`, `pnpm vitest run packages/server/test/schema-gaps.test.ts` fails with the five warning lines.
- With task 01 in place, the same run passes.

## Resume

`walkedOf` walks each provider configuration property as `root config <key>`. On the old schema, the computer case failed with the five warning lines of the plugin page. With task 01 in place, all 34 cases pass.
