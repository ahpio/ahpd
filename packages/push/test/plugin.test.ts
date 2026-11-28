import { createECDH } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { apply } from '../src/plugin.js';
import { ENDPOINT } from '../src/send.js';
import type { EventHandler, EventName, HostEventOf } from '../../sdk/src/types/events.js';
import type { PluginHost, PluginMethod } from '../../sdk/src/types/plugin.js';
import type { Owner } from '../../sdk/src/types/usage.js';
import { clearFolder } from '../../../tools/holders.ts';

/*
 * Which devices the plugin tells about a session.
 *
 * A device is a row in a file written before `apply` runs, and `host.sessionOwner`
 * is a map the host answers from, because that is the whole of what the plugin
 * asks the host to know a session's person. The plugin's connection is answered
 * here too, so a case adds a session on the root channel and moves it into
 * needing input; the service is a stub, so what a case reads is the token of
 * every device that was sent to.
 */

/** A temporary directory removed after the test that made it. */
let loose: string | undefined;
afterEach(() => {
  vi.unstubAllGlobals();
  if (loose !== undefined) clearFolder(loose);
  loose = undefined;
});

/** One host, as a plugin sees it: the handlers it registers, the owners it answers, and its connection's far end. */
interface Node {
  host: PluginHost;
  fire<K extends EventName>(event: HostEventOf<K>): Promise<void>;
  /** One notification the host sends the plugin's connection. */
  say(method: string, params: Record<string, unknown>): void;
  /** The commands the plugin registered, by name. */
  methods: Map<string, PluginMethod>;
}

const node = (configDir: string, owners: Map<string, Owner>, hasUsers: boolean): Node => {
  const handlers = new Map<EventName, EventHandler[]>();
  const methods = new Map<string, PluginMethod>();
  let heard: ((message: Record<string, unknown>) => void) | undefined;
  const host = {
    path: configDir,
    paths: [configDir],
    version: '0.10.0',
    hostName: 'Echo',
    configDir,
    hasUsers,
    log: () => {},
    say: () => {},
    problem: () => {},
    secret: async () => { throw new Error('the vault holds nothing'); },
    on: (event: EventName, handler: EventHandler) => {
      const held = handlers.get(event);
      if (held === undefined) handlers.set(event, [handler]);
      else held.push(handler);
    },
    registerResourceProvider: () => {},
    registerChannel: () => ({ publish: () => {}, subscribers: () => [] }),
    registerMethod: (name: string, method: PluginMethod) => { methods.set(name, method); },
    registerClose: () => {},
    sessionOwner: async (uri: string) => owners.get(uri),
    connect: () => ({
      send: () => {},
      notify: () => {},
      request: async (method: string) => (method === 'listSessions' ? { items: [] } : {}),
      onMessage: (handle: (message: Record<string, unknown>) => void) => { heard = handle; },
      close: () => {},
    }),
  } as unknown as PluginHost;
  return {
    host,
    fire: async (event) => {
      for (const handler of handlers.get(event.type) ?? []) await handler(event, host);
    },
    say: (method, params) => { heard?.({ jsonrpc: '2.0', method, params }); },
    methods,
  };
};

/** A service that takes every message: the Expo tokens it was sent, and the Web Push endpoints it was posted to. */
const service = () => {
  const sent: { to: string }[] = [];
  const pushed: string[] = [];
  const request = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://exp.host/')) {
      pushed.push(url);
      return new Response(null, { status: 201 });
    }
    const body: unknown = JSON.parse(String(init?.body ?? 'null'));
    const answer = url === ENDPOINT
      ? { data: (body as unknown[]).map((_one, index) => ({ status: 'ok', id: `ticket-${index}` })) }
      : { data: {} };
    if (url === ENDPOINT) sent.push(...(body as { to: string }[]));
    return new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { sent, pushed, request };
};

/** Let what the plugin started on a notification run its course. */
const settle = async (): Promise<void> => {
  for (let round = 0; round < 10; round += 1) await new Promise<void>((done) => { setImmediate(done); });
};

/** The plugin over a devices file and a map of the host's owners, listening and holding no session yet. */
const up = async (
  said: Record<string, Record<string, unknown>>,
  owners: Map<string, Owner>,
  hasUsers: boolean,
  options: Record<string, unknown> = {},
): Promise<Node & { sent: { to: string }[]; pushed: string[] }> => {
  const dir = (loose ??= mkdtempSync(join(tmpdir(), 'ahpd-push-audience-')));
  writeFileSync(join(dir, 'push-devices.json'), JSON.stringify(said, null, 2));
  const { sent, pushed, request } = service();
  vi.stubGlobal('fetch', request);
  const made = node(dir, owners, hasUsers);
  apply(made.host, options);
  await made.fire({ type: 'listening', runtime: 'node', host: '127.0.0.1', port: 9187, guarded: false });
  await settle();
  return { ...made, sent, pushed };
};

/** A session the root channel adds, then moves into needing input. */
const waiting = async (world: Node, session: string): Promise<void> => {
  world.say('root/sessionAdded', {
    channel: 'ahp-root://',
    summary: { resource: session, provider: 'echo', title: 'Fix the login', status: 1, createdAt: '2026-11-05T10:00:00.000Z', modifiedAt: '2026-11-05T10:00:00.000Z' },
  });
  world.say('root/sessionSummaryChanged', { channel: 'ahp-root://', session, changes: { status: 24 } });
  await settle();
};

/** Three phones: Ana's, Bo's, and one nobody signed in for. */
const PHONES = {
  'phone-ana': { token: 'ExponentPushToken[ana]', platform: 'ios', owner: 'user:ana' },
  'phone-bo': { token: 'ExponentPushToken[bo]', platform: 'ios', owner: 'user:bo' },
  'phone-none': { token: 'ExponentPushToken[none]', platform: 'ios' },
};

it('on a host with people, tells the devices of the session\'s owner and nobody else\'s', async () => {
  const world = await up(PHONES, new Map([['echo:/one', 'user:ana'], ['echo:/two', 'user:bo']]), true);
  await waiting(world, 'echo:/one');
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[ana]']);
  await waiting(world, 'echo:/two');
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[ana]', 'ExponentPushToken[bo]']);
});

it('on a host with people, tells nobody of a session the host names no owner for', async () => {
  const world = await up(PHONES, new Map([['echo:/one', 'user:ana']]), true);
  await waiting(world, 'echo:/one');
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[ana]']);
  await waiting(world, 'echo:/two');
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[ana]']);
});

// Softov 2026-10-31, "A setting per device (Recommended)": every session of the
// device's person, or only those this device's client created or opened.
it('tells a device set to device only the sessions its own client created or opened, and a person device those too', async () => {
  const world = await up({
    'phone-ana': { token: 'ExponentPushToken[ana]', platform: 'ios', owner: 'user:ana', client: 'app-ana', audience: 'device' },
    'phone-bo': { token: 'ExponentPushToken[bo]', platform: 'ios', owner: 'user:bo', client: 'app-bo' },
  }, new Map([['echo:/one', 'user:ana'], ['echo:/two', 'user:ana'], ['echo:/three', 'user:carol']]), true);
  await world.fire({ type: 'session_start', session: 'echo:/one', provider: 'echo', client: 'app-ana' });
  await world.fire({ type: 'session_opened', session: 'echo:/three', client: 'app-bo', owner: 'user:bo' });
  await waiting(world, 'echo:/one');
  await waiting(world, 'echo:/two');
  await waiting(world, 'echo:/three');
  // Ana's device hears the session its client made and not her other one; Bo's
  // hears the one his client opened though it is Carol's.
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[ana]', 'ExponentPushToken[bo]']);
});

/*
 * A client id is the client's own word, so on a host with people a device
 * hears a session its client opened only when its own person opened it there.
 */
it('tells a device that gave another person\'s client id nothing of that person\'s session', async () => {
  const world = await up({
    'phone-bo': { token: 'ExponentPushToken[bo]', platform: 'ios', owner: 'user:bo', client: 'app-ana', audience: 'device' },
  }, new Map([['echo:/one', 'user:ana']]), true);
  await world.fire({ type: 'session_start', session: 'echo:/one', provider: 'echo', client: 'app-ana' });
  await world.fire({ type: 'session_opened', session: 'echo:/one', client: 'app-ana', owner: 'user:ana' });
  await waiting(world, 'echo:/one');
  expect(world.sent).toEqual([]);
});

it('tells an admin\'s device of another person\'s session the admin opened on it', async () => {
  const world = await up({
    'phone-ana': { token: 'ExponentPushToken[ana]', platform: 'ios', owner: 'user:ana', client: 'app-ana', audience: 'device' },
  }, new Map([['echo:/one', 'user:carol']]), true);
  await world.fire({ type: 'session_opened', session: 'echo:/one', client: 'app-ana', owner: 'user:ana' });
  await waiting(world, 'echo:/one');
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[ana]']);
});

it('on a host with no people, tells every device of every session', async () => {
  const world = await up(PHONES, new Map(), false);
  await waiting(world, 'echo:/one');
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[ana]', 'ExponentPushToken[bo]', 'ExponentPushToken[none]']);
});

/** A Web Push subscription's keys, which the sender seals a message with. */
const KEYS = { p256dh: createECDH('prime256v1').generateKeys().toString('base64url'), auth: Buffer.alloc(16, 3).toString('base64url') };

// Softov 2026-11-28, "transport": a device goes by how it is reached, not by what it is.
it('sends a phone whose app has a relay by Web Push, and a phone with a token by Expo', async () => {
  const world = await up({
    'phone-relay': { transport: 'webpush', platform: 'android', endpoint: 'https://fcm.googleapis.com/wp/relay', keys: KEYS },
    'phone-expo': { token: 'ExponentPushToken[expo]', platform: 'android' },
  }, new Map(), false);
  await waiting(world, 'echo:/one');
  expect(world.sent.map((one) => one.to)).toEqual(['ExponentPushToken[expo]']);
  expect(world.pushed).toEqual(['https://fcm.googleapis.com/wp/relay']);
});

/** Register one device through the plugin's own command, as a client does, on a host with no people. */
const put = async (world: Node, id: string, record: Record<string, unknown>): Promise<unknown> => {
  const method = world.methods.get('x-ahpd/push/put');
  if (method === undefined) throw new Error('the plugin registered no x-ahpd/push/put');
  return await method.handle({ id, record }, undefined, 'app', undefined);
};

// Softov 2026-11-28, "New relayHosts option": a relay is allowed beside the browsers.
it('allows a relay host from relayHosts and keeps the browser push services', async () => {
  const world = await up({}, new Map(), false, { relayHosts: ['push.relay.example'] });
  await put(world, 'phone-relay', { transport: 'webpush', platform: 'android', endpoint: 'https://push.relay.example/d/1', keys: KEYS });
  await put(world, 'browser', { platform: 'web', endpoint: 'https://fcm.googleapis.com/wp/one', keys: KEYS });
  await expect(put(world, 'elsewhere', { platform: 'web', endpoint: 'https://push.other.example/d/1', keys: KEYS }))
    .rejects.toMatchObject({ code: -32602 });
});

it('allows only the hosts webPushHosts names when relayHosts is not set, as before', async () => {
  const world = await up({}, new Map(), false, { webPushHosts: ['a.example'] });
  await put(world, 'one', { platform: 'web', endpoint: 'https://a.example/d/1', keys: KEYS });
  await expect(put(world, 'two', { platform: 'web', endpoint: 'https://fcm.googleapis.com/wp/one', keys: KEYS }))
    .rejects.toMatchObject({ code: -32602 });
});

it('adds relayHosts to the hosts webPushHosts names', async () => {
  const world = await up({}, new Map(), false, { webPushHosts: ['a.example'], relayHosts: ['*.relay.example'] });
  await put(world, 'one', { platform: 'web', endpoint: 'https://a.example/d/1', keys: KEYS });
  await put(world, 'two', { transport: 'webpush', platform: 'ios', endpoint: 'https://eu.relay.example/d/2', keys: KEYS });
});
