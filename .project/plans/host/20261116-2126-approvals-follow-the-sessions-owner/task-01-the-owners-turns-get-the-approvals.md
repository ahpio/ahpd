---
title: The owner's turns get the approvals
status: todo
depends: []
layer: sdk
refs:
  - "[code://packages/sdk/src/host/spawn.ts#L520-L640](../../../../packages/sdk/src/host/spawn.ts#L520-L640) - `toolReady`, where the approval is built"
  - "[code://packages/sdk/src/host/spawn.ts#L1248-L1255](../../../../packages/sdk/src/host/spawn.ts#L1248-L1255) - `trustedBy`"
---

## Objective

On a host with users, a question in another person's turn gets no approval.
A start that another person sent gets no trust.
The owner's turns get every approval, as today.

## Files

- `UPDATE: packages/sdk/src/host/spawn.ts:520-640` - `toolReady` reads whose turn it is and leaves out the approvals for another person's turn.
- `UPDATE: packages/sdk/src/host/spawn.ts:1248-1255` - `trustedBy` reads the start's sender by the same rule.
- `UPDATE: packages/sdk/test/host-permissions.test.ts` - the cases of another person's turn.
- `UPDATE: packages/sdk/test/host-trust.test.ts` - the cases of another person's start.

## Steps

1. Write `approvesFor(session, turnId)`: true with no users file, or when the turn's sender owns the session.
2. Read the turn's sender with `senderOf`, and with `kept.sender` when the host holds it no longer.
3. Answer `undefined` from `approvesFor` for a turn with no sender, which task 02 decides.
4. Treat `undefined` as true until task 02 adds the setting.
5. In `toolReady`, when `approvesFor` is false, leave out the terminal rules, the edit patterns and the allow rules.
6. Leave out in the same case the reads inside the working folders, `globalAutoApprove` and `sessionAutoApprove`.
7. Keep the deny rules, the managed rules and the operator's always-ask in every case.
8. In `trustedBy`, read the start's sender by the same rule, and answer false for another person's start.
9. Keep the folder a plugin asked for with `session:trust` trusted in every case.

## Validation

- `host-permissions.test.ts`: on a host with users, a member's turn in an admin's `autoApprove` session asks about `rm`.
- `host-permissions.test.ts`: the owner's turn in the same session runs `rm` with no question.
- `host-permissions.test.ts`: a deny rule refuses the call in another person's turn too.
- `host-permissions.test.ts`: on a host with no users file, every turn gets the approvals.
- `host-trust.test.ts`: another person's start gets no trust, and the owner's start gets it.
- The sdk suite and the computer suite pass, one at a time.

## Resume

