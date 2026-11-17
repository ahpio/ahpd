---
title: An anonymous tunnel to the daemon requires an ahpd token
created: 2026-11-17
refs:
  - git://19ed69394 - the commit of ahpd the facts were checked at
  - "[code://packages/tunnel-devtunnel/src/kind.ts#L344-L379](../../packages/tunnel-devtunnel/src/kind.ts#L344-L379) - `hopFor`: only port 31546 has a hop, and it swaps the derived token whether or not the port is anonymous"
  - "[code://packages/tunnel-devtunnel/src/kind.ts#L503-L518](../../packages/tunnel-devtunnel/src/kind.ts#L503-L518) - `access`, the operation that turns anonymous on and off on a running tunnel"
  - "[code://packages/tunnel-devtunnel/src/kind.ts#L91-L108](../../packages/tunnel-devtunnel/src/kind.ts#L91-L108) - the `anonymous` and `requireToken` settings, both off by default"
  - "[code://packages/tunnel-devtunnel/src/discovery.ts#L24](../../packages/tunnel-devtunnel/src/discovery.ts#L24) - `TUNNEL_PORT`, 31546"
  - "[code://packages/tunnel-devtunnel/src/discovery.ts#L139](../../packages/tunnel-devtunnel/src/discovery.ts#L139) - `deriveConnectionToken`, the SHA-256 of the tunnel id"
  - "[code://packages/server/src/commands/options.ts#L1661-L1669](../../packages/server/src/commands/options.ts#L1661-L1669) - a daemon on loopback runs with no connection token unless one is given"
  - "[code://packages/tunnel-devtunnel/src/plugin.ts#L207-L213](../../packages/tunnel-devtunnel/src/plugin.ts#L207-L213) - the plugin keeps `guarded` from `listening`"
  - "[code://.project/briefs/a-cloudflare-tunnel-publishes-the-daemon.md](a-cloudflare-tunnel-publishes-the-daemon.md) - the sibling tunnel brief, which refuses a public tunnel on a daemon that is not `guarded`"
  - https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/server/node/serverConnectionToken.ts#L120-L132 - VS Code's server admits a request only with its connection token
---

# An anonymous tunnel to the daemon requires an ahpd token

Softov's goal: a visitor who reaches the daemon over an anonymous Dev Tunnel brings a token the daemon accepts.
Port 31546 is the daemon's own connection, so its token requirement cannot be off while the port is anonymous.
`requireToken` stays a setting for tunnels of other purposes, which [a-tunnel-port-is-gated-by-an-ahpd-token.md](a-tunnel-port-is-gated-by-an-ahpd-token.md) covers.

## What others do

- VS Code's server admits a request only with its connection token, as `?tkn=` or as a cookie, unless it runs with `--without-connection-token` ([`serverConnectionToken.ts`](https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/server/node/serverConnectionToken.ts#L120-L132)).
- The sibling brief [a-cloudflare-tunnel-publishes-the-daemon.md](a-cloudflare-tunnel-publishes-the-daemon.md) refuses a public tunnel on a daemon with no connection token (Softov, 2026-11-02).

## What ahpd has today

- Only port 31546 has a hop. Every other port is piped to the same port number on this machine ([`code://packages/tunnel-devtunnel/src/kind.ts`](../../packages/tunnel-devtunnel/src/kind.ts#L350)).
- The hop swaps the derived token for the key of the tunnel's person, or on a host with no users for the daemon's own token. It never reads `anonymous` ([`code://packages/tunnel-devtunnel/src/kind.ts`](../../packages/tunnel-devtunnel/src/kind.ts#L363-L376)).
- The derived token is the SHA-256 of the tunnel id, and the id is in the port's URL ([`code://packages/tunnel-devtunnel/src/discovery.ts`](../../packages/tunnel-devtunnel/src/discovery.ts#L139)). On an anonymous port anybody can compute it and get in as the tunnel's person or as the operator.
- With `requireToken` on, the hop keeps every token as the visitor wrote it ([`code://packages/tunnel-devtunnel/src/kind.ts`](../../packages/tunnel-devtunnel/src/kind.ts#L365)). It is off by default.
- A daemon on loopback runs with no connection token unless one is given ([`code://packages/server/src/commands/options.ts`](../../packages/server/src/commands/options.ts#L1661-L1669)). The hop dials the daemon on loopback. So on a host with no users and no token, an anonymous 31546 admits anyone with the URL, even with `requireToken` on.
- The plugin knows `guarded` and `hasUsers` ([`code://packages/tunnel-devtunnel/src/plugin.ts`](../../packages/tunnel-devtunnel/src/plugin.ts#L207-L213)), and reads `guarded` only for a line it says.
- `anonymous` changes on a running tunnel through the `anonymous` operation ([`code://packages/tunnel-devtunnel/src/kind.ts`](../../packages/tunnel-devtunnel/src/kind.ts#L503-L518)) and through a saved record.

## Who writes

- Another session edits [a-cloudflare-tunnel-publishes-the-daemon.md](a-cloudflare-tunnel-publishes-the-daemon.md) in `/github/ahpd`, uncommitted. That brief makes a second kind, and touches no file of `tunnel-devtunnel`. Its refusal on a daemon that is not `guarded` is the same rule as here.
- No open pull request and no branch since 2026-11-12 touches `packages/tunnel-devtunnel`.
- An untracked problem file, `an-anonymous-tunnel-admits-the-derived-token.md`, is in `/github/ahpd`. This brief covers it.

## The change

- While port 31546 is anonymous, the hop never swaps the derived token. A visitor brings a token the daemon accepts, as `?tkn=<token>`.
- While port 31546 is not anonymous, the hop swaps the derived token as today, so VS Code connects over a signed-in tunnel. `requireToken` keeps its meaning there.
- An anonymous 31546 on a daemon with no connection token and no users does not start. Turning anonymous on there is refused. The row says to set a connection token.
- The rule applies wherever `anonymous` changes: a start, the `anonymous` operation, a saved record and the plugin's `anonymous` option.
- The README, `docs/updates/v0_15.md` and the setting's description say that an anonymous 31546 needs an ahpd token, and that VS Code cannot connect to it.

| What | Source |
| --- | --- |
| The rule holds only while 31546 is anonymous | Softov, 2026-11-17: "Only while anonymous" |
| An anonymous 31546 is refused on a daemon with no token and no users | Softov, 2026-11-17: "Refuse anonymous" |
