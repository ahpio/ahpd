---
title: A tunnel port is gated by an ahpd token
created: 2026-11-17
refs:
  - git://19ed69394 - the commit of ahpd the facts were checked at
  - "[code://packages/tunnel-devtunnel/src/service.ts#L455-L466](../../packages/tunnel-devtunnel/src/service.ts#L455-L466) - a port with no handler is piped to the same port on this machine"
  - "[code://packages/tunnel-devtunnel/src/kind.ts#L350](../../packages/tunnel-devtunnel/src/kind.ts#L350) - only port 31546 gets a handler"
  - "[code://packages/tunnel-devtunnel/src/forward.ts#L191](../../packages/tunnel-devtunnel/src/forward.ts#L191) - `carry`, which reads a request as HTTP and its `tkn`, for 31546"
  - "[code://packages/sdk/src/types/plugin.ts#L1176](../../packages/sdk/src/types/plugin.ts#L1176) - `personKey`, the one token method a plugin has; none checks a token"
  - "[code://packages/tunnel-devtunnel/README.md#L76](../../packages/tunnel-devtunnel/README.md#L76) - the README says another port is forwarded as it is"
  - https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/server/node/webClientServer.ts#L312-L334 - VS Code sets a cookie from `?tkn=` and redirects to the URL without it
  - https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/server/node/serverConnectionToken.ts#L120-L132 - VS Code checks `?tkn=`, then the cookie, on every request
---

# A tunnel port is gated by an ahpd token

Softov's goal: `requireToken` on a tunnel for another purpose puts ahpd's token in front of the port it forwards.
A visitor without a token the daemon accepts reaches nothing on that port.
[an-anonymous-tunnel-requires-an-ahpd-token.md](an-anonymous-tunnel-requires-an-ahpd-token.md) covers port 31546.

## What others do

VS Code's web server is the reference, at `6b68d3fe7dd`:

- A request with one `?tkn=` gets the cookie `vscode-tkn` with that token, and a `302` to the same URL without `tkn`. The cookie is `SameSite=Lax`, for one week ([`webClientServer.ts`](https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/server/node/webClientServer.ts#L312-L334)).
- Every request is checked: the `tkn` query first, then the cookie ([`serverConnectionToken.ts`](https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/server/node/serverConnectionToken.ts#L120-L132)).
- The cookie holds the token itself, so the server keeps no state of its own.

## What ahpd has today

- Only port 31546 gets a handler ([`code://packages/tunnel-devtunnel/src/kind.ts`](../../packages/tunnel-devtunnel/src/kind.ts#L350)). Any other port is piped to the same port on this machine ([`code://packages/tunnel-devtunnel/src/service.ts`](../../packages/tunnel-devtunnel/src/service.ts#L455-L466)).
- So `requireToken` does nothing on another port today.
- `carry` reads a request on 31546 as HTTP and swaps or keeps its `tkn` ([`code://packages/tunnel-devtunnel/src/forward.ts`](../../packages/tunnel-devtunnel/src/forward.ts#L191)). It does not check a token: the daemon does.
- A plugin cannot ask whether a token is one the daemon accepts. `personKey` mints a key and checks nothing ([`code://packages/sdk/src/types/plugin.ts`](../../packages/sdk/src/types/plugin.ts#L1176)).

## Who writes

- No open pull request and no branch since 2026-11-12 touches `packages/tunnel-devtunnel`.
- The sdk's plugin host gains a method, so a plugin built against the sdk sees one more member. No first-party plugin implements `PluginHost`.
- [an-anonymous-tunnel-requires-an-ahpd-token.md](an-anonymous-tunnel-requires-an-ahpd-token.md) changes the hop on 31546 in the same file. The two plans stack, 31546 first.

## The change

- With `requireToken` on, a port other than 31546 gets a gate in place of the pipe.
- The gate reads each request as HTTP, takes the token from `?tkn=` or from the cookie `ahpd-tkn`, and asks the daemon whether it accepts it.
- A request with an accepted `?tkn=` is answered `302` to the same URL without `tkn`, with the cookie set.
- A request with an accepted cookie goes to the port, without the `ahpd-tkn` cookie.
- Each request is checked again, so a revoked token stops passing at the next request.
- A request with no accepted token is answered `401`, and nothing reaches the port.
- A WebSocket upgrade is a request too, and passes by the same check.
- The plugin host gains a check of a token, which answers whether the daemon accepts it.
- The README and the setting's description say what `requireToken` does on another port.

| What | Source |
| --- | --- |
| `requireToken` on another port gates the port by an ahpd token | Softov, 2026-11-17: "Gate the port by a token" |
| A visitor carries `?tkn=` once, then a cookie | Softov, 2026-11-17: "?tkn= once, then a cookie" |
| Any token the daemon accepts passes | Softov, 2026-11-17: "Any accepted token" |
| The cookie holds the token, and each request checks it again | (defaulted: as VS Code; no secret to keep or revoke) |
| The cookie is `HttpOnly`, `Secure` and `SameSite=Lax`, for one week | (defaulted: VS Code's lifetime; the port's app has no reason to read it) |
| The port's app never sees `tkn` or the cookie | (defaulted: an ahpd credential stays out of another app) |
| A request with no accepted token gets `401`, and a connection that is not HTTP is closed | (defaulted: the gate reads HTTP only) |
| The plugin host checks a token, not the plugin | (defaulted: only the daemon knows its tokens) |
