---
title: x-ahpd/backgroundToolCall moves one call
status: todo
depends: [task-01-a-call-offers-to-move.md]
layer: "sdk"
refs:
  - "[code://packages/sdk/src/host/vscodemethods.ts#L508-L517](../../../../packages/sdk/src/host/vscodemethods.ts#L508-L517) - `vscode/stopBackgroundWork`, the checks and answers to copy"
  - "[code://packages/sdk/src/host/gate.ts#L67-L73](../../../../packages/sdk/src/host/gate.ts#L67-L73) - the method table and its grants"
  - "[code://packages/sdk/src/host/root.ts#L680-L692](../../../../packages/sdk/src/host/root.ts#L680-L692) - `advertisedMethods`, the `ahpd.methods` list"
---

## Objective

A client calls `x-ahpd/backgroundToolCall { chat, toolCallId }` and is answered `{ backgrounded: boolean }`.
The method asks for `chat:send`, and a client finds it in `ahpd.methods`.

## Files

- `UPDATE: packages/sdk/src/host/vscodemethods.ts:508-517` - serve `x-ahpd/backgroundToolCall` beside `vscode/stopBackgroundWork`, with the same checks.
- `UPDATE: packages/sdk/src/host/gate.ts:67-73` - add `'x-ahpd/backgroundToolCall': 'chat:send'`, with a comment on why it is not `chat:cancel`.
- `UPDATE: packages/sdk/src/host/root.ts:680-692` - list the method in `ahpd.methods`, with its title and grant.
- `UPDATE: packages/sdk/test/host-movable-calls.test.ts` - the method's answers and refusals.

## Steps

1. Serve the method, reading `chat` and `toolCallId` with `stringParam`.
2. Refuse an empty `toolCallId`, a bad URI and a URI that is not a chat.
3. Use the words of `vscode/stopBackgroundWork` for each refusal.
4. Answer `{ backgrounded: await ctx.background.move(chat, toolCallId) }`.
5. Add the grant row to `gate.ts`.
6. Add the method to `advertisedMethods`, with the title "Run in background".
7. Run the staleness and wire tests, and add the method where they ask for it.

## Validation

- `packages/sdk/test/host-movable-calls.test.ts` holds these cases:
  - An offered call answers `true`.
  - An unknown chat, an unknown call and a completed call answer `false`.
  - The gate refuses a person without `chat:send`.
- `npx vitest run packages/sdk/test/wire.test.ts packages/sdk/test/host-movable-calls.test.ts` passes.

## Resume

