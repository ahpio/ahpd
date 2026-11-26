---
title: A new bot writes over the persona of another host's bot in the same folder
status: open
date: 2026-11-25
severity: major
refs:
  - "[code://packages/bot/src/provider.ts#L489-L505](../../packages/bot/src/provider.ts#L489-L505) - `workspaceFor`, which looks for a clash among this host's bots only"
  - "[code://packages/bot/src/provider.ts#L700-L722](../../packages/bot/src/provider.ts#L700-L722) - a make that finds an `AGENTS.md` writes its parts into it"
  - git://ce998141e - main when the problem was read
---

## Symptom

Two hosts on one machine share the default bot root, `~/.bots`.
A bot made on one host under the slug of a bot of the other host gets the same folder.
The make writes its name, description and instructions into the `AGENTS.md` that is there.
The other bot's description and instructions are lost.

On 2026-11-25 a test host made the bot `goo` and rewrote the `AGENTS.md` of Softov's own `goo`.
The test host had its own `XDG_CONFIG_HOME`, so its bot store was empty and saw no clash.

To show it again, start two hosts with different configuration folders and the default bot `root`.
Make a bot with a description on the first, then a bot with the same slug on the second.

## Cause

`workspaceFor` refuses a folder only when a record of this host's store names it.
A folder that another host's bot uses is not in that store.
A make that finds a readable `AGENTS.md` treats it as the new bot's own file, and writes the new parts into it.

## Impact

A test host, or a second daemon of the same user, can overwrite a bot's persona with no warning.
The `AGENTS.md` is the one copy of the persona, so nothing can restore it.

## Workaround

Give each extra host its own bot root, with the bot plugin option `root`.

## Fix

- A make refuses a folder that already holds an `AGENTS.md`, unless the body names the folder.
- A make records the host's id in the folder, and refuses a folder that names another host.
- The default bot root is one folder per host, such as `~/.bots/<host-id>`. A bot that is there already keeps the folder its record names.
