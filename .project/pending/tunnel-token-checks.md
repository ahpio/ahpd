---
title: Check the anonymous tunnel gate
plans:
  - plans/plugin/20261117-0701-anonymous-31546-requires-a-token/plan.md
---

# Check the anonymous tunnel gate

These need your dev daemon's Dev Tunnel, `giant-ant-5q89765` in cluster `brs`, signed in as you. The suites of all three plans pass on main at `2946984b6`.

## Set up

1. Restart your dev daemon from `/github/ahpd` on main, in its own terminal, as you always do.
2. In a second terminal, run these lines. They name the tunnel and the rpc client, and they write the derived token and your connection token to files:

```bash
cd /github/ahpd
T=giant-ant-5q89765; U=wss://$T-31546.brs.devtunnels.ms
node -e 'const h=require("crypto").createHash("sha256").update(process.argv[1]).digest("base64url");console.log(h.startsWith("-")?"a"+h:h)' $T > /tmp/derived-token
cp /home/softov/.vscode/cli/agent-host-token /tmp/own-token
ahpd() { node --conditions development --import ./scripts/dev.mjs packages/server/src/main.ts "$@" --config-file /home/softov/.config/ahpd/config-dev.json; }
try() { AHPD_URL=$U AHPD_TOKEN_FILE=$1 node .project/pending/rpc.mjs listSessions '{}' 4000 | head -c 200; echo; }
```

`/home/softov/.vscode/cli/agent-host-token` is the token your `config-dev.json` names. `ahpd` runs against your dev configuration. `try <file>` connects to port 31546 over the tunnel with the token in that file. It prints `ANSWER` when the daemon admits the token. It prints `initialize failed` or `CLOSED` when the daemon refuses it.

## An anonymous 31546 refuses the derived token

Done on 2026-11-18 on the dev daemon, at `wss://hwnqpfb0-31546.brs.devtunnels.ms`: no token and both derived tokens got `401`, and Softov's own token got the session list. Only step 5, VS Code with `anonymous` off, is left.

1. In ahpw, open the tunnels page, and on the row for port 31546 run the `anonymous` operation with `on` set.
2. Run `try /tmp/derived-token`. Pass: `initialize failed` or `CLOSED`. Fail: `ANSWER`.
3. Run `try /tmp/own-token`. Pass: `ANSWER`. Fail: anything else.
4. Run `anonymous` with `on` cleared on the same row.
5. In VS Code, run **Agents: Connect to Remote Agent Host via Dev Tunnel**, and pick `soft-sandbox`. Pass: the host connects. Fail: it does not.

## No anonymous tunnel on a daemon with no token and no users

The run of 2026-11-18 started the tunnel, because `--plugin ./packages/tunnel-devtunnel` loaded the built `dist/`, which dated from 2026-11-10 and did not hold the fix. The step now loads the plugin's source. A daemon started this way logs `no token: loopback only`, so the fix refuses its anonymous 31546.

1. Run the test daemon with no token and no users file, in a third terminal:

```bash
mkdir -p ~/ahpd-open/config/ahpd ~/ahpd-open/work && cd /github/ahpd
XDG_CONFIG_HOME=~/ahpd-open/config XDG_STATE_HOME=~/ahpd-open/state XDG_DATA_HOME=~/ahpd-open/data \
  node --conditions development --import ./scripts/dev.mjs packages/server/src/main.ts --path ~/ahpd-open/work --port 39300 --no-cwd --plugin ./packages/tunnel-devtunnel/src/index.ts
```

2. In ahpw, connect to `ws://127.0.0.1:39300`, make a `devtunnel` connector, and sign in with GitHub.
3. Run `anonymous` with `on` set on the row for port 31546. Pass: the operation is refused, and the row says to set a connection token or a users file first. Fail: the tunnel starts.
4. Stop that daemon with Ctrl+C, and run `rm -rf ~/ahpd-open`.

## Clean up

Run `rm -f /tmp/derived-token /tmp/own-token`.
