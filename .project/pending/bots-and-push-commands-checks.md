---
title: Check that bots and push devices take commands
plans:
  - plans/plugin/20261116-1940-bots-and-push-take-commands/plan.md
---

# Check that bots and push devices take commands

A host with this change serves `x-ahpd/bots/*` and `x-ahpd/push/*`, and sends the bot list as `{ records }`. ahpw and ahpapp send the commands. All three are on main: ahpio/ahpd#359, ahpio/ahpw#99 and softov/ahpapp#1.

## Set up

1. Bring each checkout to main. A checkout on another branch, or with changes not committed, is another session's: use a worktree of main for it instead.

```bash
cd /github/ahpd && git switch main && git pull --ff-only
cd /github/ahpw && git switch main && git pull --ff-only && pnpm install
cd /github/ahpapp && git switch main && git pull --ff-only && npm install
```

2. Stop your dev daemon with Ctrl+C in its terminal, and start it again from ahpd main:

```bash
cd /github/ahpd
node --conditions development --import ./scripts/dev.mjs packages/server/src/main.ts --config-file /home/softov/.config/ahpd/config-dev.json
```

3. Start ahpw from main, with `AHPD_URL` on that daemon:

```bash
cd /github/ahpw
AHPD_URL=http://127.0.0.1:37537 pnpm dev --port 5180
```

## Checks in ahpw

1. Open the bots list.
   - Pass: every bot you had is listed.
   - Fail: the list is empty, which means ahpw did not read `{ records }`.
2. Make a bot, edit its name, then delete it. In the browser's network tab, watch the WebSocket frames.
   - Pass: the frames are `x-ahpd/bots/put` twice and `x-ahpd/bots/remove` once, and the list follows each.
   - Fail: a `resourceWrite` or `resourceDelete` on `bot://`.
3. Open a bot you have talked to, from its floating face.
   - Pass: your talk opens, and no `resourceRead` of `bot://<slug>` is sent.
   - Fail: a new empty talk, or a `resourceRead` of the bot.
4. Edit the same bot in two tabs, and save the older one second.
   - Pass: the second save is refused as changed on the host.
   - Fail: the second save wins.
5. With a bot's page open, change the `description:` line in its `AGENTS.md` in an editor and save.
   - Pass: the page shows the new description without a reload.
   - Fail: the old description stays until you reload.
6. Turn push on from the command palette, then turn it off.
   - Pass: the frames are `x-ahpd/push/put` and `x-ahpd/push/remove`.
   - Fail: a `resourceWrite` on `push://devices`.
7. With push on, use Sign out.
   - Pass: `x-ahpd/push/remove` is sent before the sign-out page.
   - Fail: the device stays on the host.

## Checks in ahpapp

Run the app from `/github/ahpapp` on main, with `npm run web` or on your phone, against the same daemon.

1. Open the bots tab.
   - Pass: every bot is listed.
   - Fail: the tab is empty.
2. Make, edit and delete a bot.
   - Pass: each change shows at once, with no reload.
   - Fail: an error, or a change that shows only after a reload.
3. Open a computer, and press Stop, then Start.
   - Pass: its state changes on the screen without a reload.
   - Fail: the state stays as it was until you leave and come back.
4. On your phone, with push on, give the host a new token in its settings.
   - Pass: notifications reach the phone for the person of the new token.
   - Fail: no notification, and the daemon log has a `-32009` for `push://devices`.
