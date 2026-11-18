---
title: Check the tunnel token gate and a deleted tunnel coming back
plans:
  - plans/plugin/20261117-0701-anonymous-31546-requires-a-token/plan.md
  - plans/plugin/20261117-0701-a-tunnel-port-is-gated-by-a-token/plan.md
  - plans/plugin/20261117-2030-a-deleted-tunnel-is-made-again/plan.md
---

# Check the tunnel token gate and a deleted tunnel coming back

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

1. Run the test daemon with no token and no users file, in a third terminal:

```bash
mkdir -p ~/ahpd-open/config/ahpd ~/ahpd-open/work && cd /github/ahpd
XDG_CONFIG_HOME=~/ahpd-open/config XDG_STATE_HOME=~/ahpd-open/state XDG_DATA_HOME=~/ahpd-open/data \
  node --conditions development --import ./scripts/dev.mjs packages/server/src/main.ts --path ~/ahpd-open/work --port 39300 --no-cwd --plugin ./packages/tunnel-devtunnel
```

2. In ahpw, connect to `ws://127.0.0.1:39300`, make a `devtunnel` connector, and sign in with GitHub.
3. Run `anonymous` with `on` set on the row for port 31546. Pass: the operation is refused, and the row says to set a connection token or a users file first. Fail: the tunnel starts.
4. Stop that daemon with Ctrl+C, and run `rm -rf ~/ahpd-open`.

## A gated port

1. Run a small app on port 39400: `python3 -m http.server 39400 --bind 127.0.0.1` in a fourth terminal.
2. In ahpw, add a tunnel record of the kind `devtunnel` for port 39400 with `requireToken` on, and start it. Its row shows the URL, `https://<name>-39400.brs.devtunnels.ms`.
3. Run `curl -s -o /dev/null -w '%{http_code}\n' <URL>/`. Pass: `401`. Fail: `200`.
4. Run `curl -s -D - -o /dev/null "<URL>/?tkn=$(cat /tmp/own-token)" | grep -i 'location\|set-cookie'`. Pass: a `location` without `tkn`, and a `set-cookie: ahpd-tkn=` that is `HttpOnly`, `Secure` and `SameSite=Lax`. Fail: no cookie.
5. Open `<URL>/?tkn=<your token>` in a browser. Pass: the directory listing loads, and the address bar has no `tkn`. Fail: a `401` or a `tkn` left in the address.
6. In the terminal of step 1, read the request lines. Pass: no line has `tkn=`. Fail: one has.
7. Run `ahpd user add gatecheck --role member`, then `ahpd user token gatecheck`, and open `<URL>/?tkn=<that token>` in a private browser window.
8. Run `ahpd user rm gatecheck`, then reload the private window. Pass: `401`. Fail: the listing loads.
9. Stop the record in ahpw and remove it, then stop the app with Ctrl+C.

## A deleted tunnel is made again

1. Note the URL on the row for port 31546 in ahpw.
2. Run `devtunnel delete giant-ant-5q89765 --force`. The `devtunnel` command must be signed in to the same account.
3. Reload the tunnels page in ahpw. Pass: within one reload the row says `running` with a new tunnel name and a new URL. Fail: it reports an error or `unknown tunnel`.
4. Restart the dev daemon. Pass: the row says `running` again, with the tunnel of step 3. Fail: it makes a third tunnel or reports an error.
5. In VS Code, connect through the new tunnel as in step 5 of the first section. Pass: the host connects.

## Clean up

Run `rm -f /tmp/derived-token /tmp/own-token`.
