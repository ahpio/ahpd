---
title: A records channel has commands
status: implemented
depends: [task-01-bots-take-put-and-remove.md, task-03-push-devices-take-commands.md]
layer: "server"
refs:
  - "[code://packages/sdk/src/host/handshake.ts#L568](../../../../packages/sdk/src/host/handshake.ts#L568) - `ahpd.methods`, which the test reads"
---

## Objective

A test fails when the daemon serves an `x-ahpd-<domain>` channel and no `x-ahpd/<domain>/put` or `/remove` command, unless the channel is on the test's list of read-only channels.

## Files

- `CREATE: packages/server/test/records-commands.test.ts` - the guard, over a spawned daemon with the bundled plugins and a users file.

## Steps

1. Start a daemon with every bundled plugin that serves a channel.
2. Read `ahpd.channels` and `ahpd.methods` from `initialize`.
3. List each channel whose domain has no `put` or `create`, or no `remove`, apart from the read-only list.
4. Name each read-only channel in the test with one line on why it has no commands.
5. Expect the list to be empty.

## Validation

- The test passes on this branch.
- The test fails with `x-ahpd-bots` named when the bot commands are removed.

## Resume

Built on 2026-11-16. `x-ahpd-computers` makes with `create`, so the guard takes `create` as well as `put`. With the bot commands taken out, the test fails.

