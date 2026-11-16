---
title: Bots and push devices take commands
domain: plugin
status: active
priority: high
created: 2026-11-16
revalidated: 2026-11-16
requires:
  - plans/host/81-host-records-get-channels-and-commands/plan.md
refs:
  - "[code://packages/sdk/src/resources/recordschannel.ts#L453-L494](../../../../packages/sdk/src/resources/recordschannel.ts#L453-L494) - `recordsMethods`, the `put` and `remove` shape every records domain shares"
  - "[code://packages/sdk/src/resources/recordschannel.ts#L134](../../../../packages/sdk/src/resources/recordschannel.ts#L134) - `recordsChannel`, which the push channel uses"
  - "[code://packages/bot/src/catalogue.ts](../../../../packages/bot/src/catalogue.ts) - the bot channel, which changes shape"
  - "[code://packages/bot/src/provider.ts#L550-L580](../../../../packages/bot/src/provider.ts#L550-L580) - a read of one bot, the record the channel sends"
  - "[code://packages/bot/src/provider.ts#L598-L741](../../../../packages/bot/src/provider.ts#L598-L741) - the bot write and delete, which the commands run"
  - "[code://packages/bot/src/plugin.ts#L601-L638](../../../../packages/bot/src/plugin.ts#L601-L638) - where the channel and the provider are registered"
  - "[code://packages/push/src/provider.ts#L529-L558](../../../../packages/push/src/provider.ts#L529-L558) - the push write and delete, with no owner check"
  - "[code://packages/push/src/plugin.ts#L158](../../../../packages/push/src/plugin.ts#L158) - where the push scheme is registered"
  - "[code://packages/sdk/src/types/plugin.ts#L551-L575](../../../../packages/sdk/src/types/plugin.ts#L551-L575) - `PluginMethod`, with the caller's reader, client and owner"
---

## Goal

A client changes a bot and a push device with an `x-ahpd/<domain>/put` or `/remove` command, and reads each from a channel, as it does users, policies and computers.
The bot channel sends what a read of one bot answers, so a client stops reading each bot.
A person changes only their own push devices.
`resourceRead`, `resourceWrite` and `resourceDelete` on `bot://` and `push://` keep working through 0.15.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `git grep -E "recordsChannel|recordsMethods|recordsDomain" packages` - every records domain but bots and push has a channel and commands.
- `git grep -h -o "x-ahpd/[a-z-]+/[a-z-]+" packages` - no `x-ahpd/bots/` or `x-ahpd/push/` command.
- `git grep -E "resourceRead|resourceWrite" ahpw ahpapp` - both clients write bots and push devices with the resource methods.

### Runtime path

```
client x-ahpd/bots/put -> host gate bot:put -> bot plugin method -> provider write (mayWrite, ifMatch) -> store -> catalogue -> x-ahpd-bots/changed per reader
client x-ahpd/push/put -> host gate push:put -> push plugin method -> provider write (owner check) -> store -> x-ahpd-push refresh -> added
```

### Gaps

- The bot plugin registers no command, and its channel sends `{ bots }` with the stored record only.
- The push plugin registers no command and no channel.
- The push write and delete check no owner.
- No test catches a records channel without commands.

## Answers

| What | Source | Task |
| --- | --- | --- |
| The resource methods on `bot://` and `push://` stay through 0.15; removing them is a 0.16 decision | Softov, 2026-11-16: "We could keep the support the resource Read/Write while implementing the support that lacks. Then on 0.16 we can drop those if necessary." | 01, 03 |
| Push devices get commands and a channel | Softov, 2026-11-16, "Commands and a channel" | 03 |
| The bot channel changes to `{ records }` now | Softov, 2026-11-16, "Change to { records } now" | 02 |
| The bot channel record carries the `AGENTS.md` fields, `state` and the reader's `session` | Softov, 2026-11-16, "Carry all three" | 02 |
| A push device registered by another person is refused | Softov, 2026-11-16, "Refuse it" | 03 |
| Any signed-in person subscribes to their own devices with no grant | Softov, 2026-11-16, "Any signed-in person" | 03 |
| The push owner check applies to the resource methods too, in 0.15 | Softov, 2026-11-16, "Both paths, now" | 03 |
| Bot `put` takes `ifMatch`, compared with `updatedAt` | (defaulted: ahpw edits a bot with `ifMatch` today, and two people saving one bot must not overwrite each other) | 01 |
| The guard test keeps its list of read-only channels in the test | (defaulted: one place to read, no new field on a channel) | 04 |
| An edit a bot makes to its own `AGENTS.md` reaches the channel, through a watch on each bot's workspace folder | Softov, 2026-11-16, "add task 05 and build it" | 05 |
| A watch on one file reports its edits as `updated`, not `deleted` | Softov, 2026-11-16: "the event deleted is wrong, we also need a fix for that" | 06 |
| A caller that holds `*:*`, the root connection and a host with no users may change any push device | (defaulted: the same rule `mayWrite` has for a bot) | 03 |

## Proposed architecture

- **Data flow** - a command builds the `Write` a `resourceWrite` carries and calls the provider's own `write` or `delete`, so both doors run one set of rules.
- **Event flow** - the bot provider tells the catalogue as it does today. The catalogue sends one action for each person who talks to the bot and one for every other reader, each with a `visible` test. A kept talk tells the catalogue too. The push provider calls a `changed` callback, and the push channel refreshes.
- **State flow** - the stores stay the record of truth. The bot catalogue keeps the ids each reader holds; the push channel is a `recordsChannel` and keeps what it sent.
- **Layer responsibilities** - `packages/bot`: commands, catalogue shape and record, the `AGENTS.md` watch · `packages/push`: commands, channel, owner check · `packages/sdk`: a file watch kept on its folder · `packages/server`: the guard test.
- **Source-of-truth files** - [`code://packages/bot/src/catalogue.ts`](../../../../packages/bot/src/catalogue.ts), [`code://packages/push/src/provider.ts`](../../../../packages/push/src/provider.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - bots-take-put-and-remove](task-01-bots-take-put-and-remove.md) | implemented | - |
| [02 - the-bot-channel-sends-records](task-02-the-bot-channel-sends-records.md) | implemented | - |
| [03 - push-devices-take-commands](task-03-push-devices-take-commands.md) | implemented | - |
| [04 - a-records-channel-has-commands](task-04-a-records-channel-has-commands.md) | implemented | 01, 03 |
| [05 - a-bots-own-edit-reaches-the-channel](task-05-a-bots-own-edit-reaches-the-channel.md) | implemented | 02 |
| [06 - a-file-watch-hears-the-file](task-06-a-file-watch-hears-the-file.md) | implemented | - |

## Risks and tradeoffs

- The bot channel shape change breaks a client that reads `{ bots }` - ahpw and ahpapp read both shapes in their own plans, and the host ships with them.
- A bot change costs one publish for each person who talks to it - the talks are read at each snapshot and kept in the catalogue, so a publish needs no read and a replay asks the same test.
- One watch per local bot's workspace folder, not recursive - a large workspace costs nothing more, and a bot in a machine has none.

## Resume state

- **Done so far:** tasks 01 to 06 built on branch `plugin/20261116-1940-bots-and-push-take-commands` on 2026-11-16, awaiting review. `pnpm typecheck` and `pnpm test:unit` pass: 520 files, 9121 tests.
- **Next action:** Softov's review, then the pull request.
- **Watch out for:** the bot read and the channel must answer the same record; build both from one function.

## Final verification checklist

- [ ] `pnpm -r typecheck` passes.
- [ ] The bot, push and server suites pass, one at a time.
- [ ] `ahpd.methods` lists `x-ahpd/bots/put`, `x-ahpd/bots/remove`, `x-ahpd/push/put` and `x-ahpd/push/remove`.
