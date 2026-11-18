---
title: Configure reads a relative path from the current folder
status: open
date: 2026-11-18
severity: major
refs:
  - "[code://packages/server/src/commands/configure.ts](../../packages/server/src/commands/configure.ts) - `configure` reads the raw entry, and opens `users` and `connectionTokenFile` as written"
  - "[code://packages/server/src/config.ts#L1034-L1043](../../packages/server/src/config.ts#L1034-L1043) - `anchored`, which resolves those keys against the configuration file's folder for the daemon"
---

## Symptom

On 2026-11-18, the check of daemon/20261118-0129 on the test daemon ran `ahpd configure` from `/home/softov`.
The test configuration names its users file as `users.json`.

- The role question listed `admin, guest, member`, without the file's own role `senders`.
- `Added zed to users.json.` wrote a new `/home/softov/users.json`, and not the file the daemon reads.

## Cause

`configure` reads the entry with `readEntry`, which keeps a relative path as written.
It opens `users` with that path, so the path is read against the folder the command runs in.
The daemon and `ahpd user add` read the same key through `anchored`, against the folder of the configuration file.
`connectionTokenFile` has the same flaw in `configure`, from before daemon/20261118-0129: a relative token file is read and written in the current folder.

## Impact

With a relative `users` key, a person that `configure` adds is unknown to the daemon. A stray users file is left behind.
A relative `connectionTokenFile` gets a token the daemon never reads.

## Workaround

Write `users` and `connectionTokenFile` as absolute paths, or run `configure` from the configuration folder.

## Fix

No fix is chosen.
