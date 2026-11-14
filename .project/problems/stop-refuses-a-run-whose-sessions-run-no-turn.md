---
title: Stop refuses a run whose sessions run no turn
status: open
date: 2026-11-14
severity: minor
refs:
  - "[code://packages/sdk/src/host/automations.ts#L350-L362](../../packages/sdk/src/host/automations.ts#L350-L362) - `cancelRun`: a run with sessions is stopped only through a turn that runs"
  - "[code://packages/sdk/src/automations/automations.ts#L703-L723](../../packages/sdk/src/automations/automations.ts#L703-L723) - a start fails a run that was not over as interrupted"
  - https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/agentHost/node/agentHostAutomationService.ts#L740-L762 - VS Code's host refuses the same cancellation
---

## Symptom

- On 2026-11-14, Softov ran the automation "Test automation" by hand, with the model `opus[1m]`, which Claude no longer offers.
- The host ended the session's first turn with `modelSelectionFailed`, and the run stayed `running`.
- Stop on that run answers "Automation run cancellation was not accepted".

## Cause

- `cancelRun` settles a run with no session at once. For a run with sessions, it stops their running turns, and the turns' endings settle the run.
- When no session of the run has a running turn, nothing can end the run, so `cancelRun` refuses. VS Code's host refuses the same case.
- A run gets into that state only when a turn ends without settling its run. The fix in `automations/a-failed-first-turn-settles-its-run` removes the known case, a turn that the host ends itself.

## Impact

- A run that a future defect leaves `running` cannot be stopped from a client.
- While the automation is on, its next wakes wait behind that run.

## Workaround

Restart the daemon. A start fails a run that was not over as interrupted.

## Fix

- Stop settles a run none of whose sessions runs a turn, as `cancelled`. This differs from VS Code's host.
- Keep the refusal, and rely on every turn end to settle its run.
