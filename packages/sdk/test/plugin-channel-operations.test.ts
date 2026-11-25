import { loggerOf } from '../src/log.js';
import { expect, it } from 'vitest';
import { invokeOperation, pluginOperationChannels } from '../src/kinds/operations.js';
import { foldHostOptions, pluginHost } from '../src/plugins/plugins.js';
import { fileResources } from '../src/resources/resources.js';
import { sdkVersion } from '../src/version.js';
import { echo } from '../../../examples/echo/agent.js';
import type { Operation } from '../src/types/kinds.js';
import type { LoaderContext, PluginChannel } from '../src/types/plugin.js';
import type { Principal } from '../src/types/users.js';

/*
 * A plugin channel that offers operations to `x-ahpd/invokeOperation`.
 *
 * One plugin, `svc`, registers `x-svc` with an operations side offering one
 * operation on one service, `svc/restart`, under its own grant. The fold is the
 * one the daemon makes, and `pluginOperationChannels` is what the daemon hands
 * the command, so a case here runs the path a client's call takes.
 */

const root = '/nonexistent-plugin-channel-operations';

const context = (): LoaderContext => ({ path: root, paths: [root], version: sdkVersion(), hostName: 'test', configDir: root, log: loggerOf(() => {}), say: () => {} });

/** A caller holding exactly these grants. */
const holding = (grants: string[]): Principal => ({
  id: 'ana', roles: [], can: (grant: string) => grants.includes(grant),
});

const RESTART: Operation = { id: 'svc/restart', kind: 'svc', label: 'Restart', scopes: ['service'], grant: 'svc:restart', status: 'idle' };

/** The command over a fold holding the `svc` plugin, and what its channel was asked to do. */
function served(side: Partial<NonNullable<PluginChannel['operations']>> = {}) {
  const ran: { id: string; target?: string; reader?: string }[] = [];
  const settled: { id: string; target?: string; error?: string }[] = [];
  const { host: plugin, contribution } = pluginHost('svc', context());
  plugin.registerGrants('svc', { operations: ['restart'] });
  plugin.registerChannel('x-svc', {
    grant: 'svc:read',
    snapshot: () => ({ services: ['web'], operations: [RESTART] }),
    operations: {
      operations: () => [RESTART],
      begin: () => {},
      settle: (id, target, error) => { settled.push({ id, ...(target === undefined ? {} : { target }), ...(error === undefined ? {} : { error }) }); },
      offers: (target) => target === 'web',
      run: async (operation, target, _input, reader) => {
        ran.push({ id: operation.id, ...(target === undefined ? {} : { target }), ...(reader === undefined ? {} : { reader: reader.id }) });
        return { restarted: target };
      },
      ...side,
    },
  });
  const folded = foldHostOptions({
    path: root,
    agents: [{ ...echo({ path: root, pace: 0 }), provider: 'base', displayName: 'Base' }],
    resources: fileResources(),
  }, [contribution]);
  expect(folded.problems).toEqual([]);
  const channels = pluginOperationChannels(folded.options.channels);
  const method = invokeOperation({ channels: () => channels, check: () => {} });
  return { method, channels, ran, settled };
}

it('serves a plugin channel\'s operations at its scheme, and leaves out a channel with none', () => {
  const { channels } = served();
  expect(Object.keys(channels)).toEqual(['x-svc://']);
  expect(pluginOperationChannels({ 'x-plain': { channel: { grant: 'x:read', snapshot: () => ({}) } as PluginChannel } })).toEqual({});
});

it('cannot offer operations on a scheme a plugin folded earlier registered, the daemon\'s included', () => {
  const { host: first, contribution: daemon } = pluginHost('ahpd', context());
  first.registerChannel('x-ahpd-tunnels', { grant: 'tunnel:read', snapshot: () => ({}) });
  const { host: rogue, contribution } = pluginHost('rogue', context());
  rogue.registerGrants('rogue', { operations: ['go'] });
  rogue.registerChannel('x-ahpd-tunnels', {
    grant: 'rogue:go',
    snapshot: () => ({}),
    operations: { operations: () => [{ ...RESTART, grant: 'rogue:go' }], run: async () => ({}) },
  });
  const folded = foldHostOptions({ path: root, agents: [{ ...echo({ path: root, pace: 0 }), provider: 'base', displayName: 'Base' }], resources: fileResources() }, [daemon, contribution]);
  expect(folded.problems).toContain('plugin rogue registers channel x-ahpd-tunnels, which plugin ahpd already registered');
  expect(pluginOperationChannels(folded.options.channels)).toEqual({});
});

it('runs an operation of a channel that leaves out offers, begin and settle', async () => {
  const { host: plugin, contribution } = pluginHost('svc', context());
  plugin.registerGrants('svc', { operations: ['restart'] });
  plugin.registerChannel('x-svc', {
    grant: 'svc:read',
    snapshot: () => ({}),
    operations: { operations: () => [RESTART], run: async (_operation, target) => ({ restarted: target }) },
  });
  const folded = foldHostOptions({ path: root, agents: [{ ...echo({ path: root, pace: 0 }), provider: 'base', displayName: 'Base' }], resources: fileResources() }, [contribution]);
  expect(folded.problems).toEqual([]);
  const method = invokeOperation({ channels: () => pluginOperationChannels(folded.options.channels), check: () => {} });
  expect(await method.handle({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'anything' } }, holding(['svc:restart']), 'c1'))
    .toEqual({ restarted: 'anything' });
});

it('runs a list-scoped operation with no target, and checks its input against its schema', async () => {
  const ADD: Operation = { id: 'svc/add', kind: 'svc', label: 'Add', scopes: ['list'], grant: 'svc:restart', status: 'idle', input: { type: 'object', required: ['name'] } };
  const checked: unknown[] = [];
  const one = served({ operations: () => [RESTART, ADD], run: async (operation, target, input) => ({ id: operation.id, target: target ?? null, input }) });
  const method = invokeOperation({
    channels: () => one.channels,
    check: (value) => { checked.push(value); if (typeof value !== 'object' || value === null || !('name' in value)) throw new Error('input needs a name'); },
  });
  expect(await method.handle({ channel: 'x-svc://', operationId: 'svc/add', input: { name: 'web' } }, holding(['svc:restart']), 'c1'))
    .toEqual({ id: 'svc/add', target: null, input: { name: 'web' } });
  await expect(method.handle({ channel: 'x-svc://', operationId: 'svc/add', input: {} }, holding(['svc:restart']), 'c1')).rejects.toThrow('input needs a name');
  expect(checked).toEqual([{ name: 'web' }, {}]);
});

it('leaves out a listed operation it cannot serve, says it, and reports it and an undeclared grant at the load', async () => {
  const listed = (): unknown => [RESTART, { id: 'svc/broken', scopes: 'service', grant: 'svc:restart' }, { ...RESTART }, { ...RESTART, id: 'svc/stop', grant: 'svc:stop' }];
  const { host: plugin, contribution } = pluginHost('svc', context());
  plugin.registerGrants('svc', { operations: ['restart'] });
  plugin.registerChannel('x-svc', { grant: 'svc:read', snapshot: () => ({}), operations: { operations: listed as () => Operation[], run: async () => ({}) } });
  const folded = foldHostOptions({ path: root, agents: [{ ...echo({ path: root, pace: 0 }), provider: 'base', displayName: 'Base' }], resources: fileResources() }, [contribution]);
  expect(folded.problems).toEqual([
    'plugin svc lists operation svc/broken at x-svc://, which is not served: its scopes are not a list of names',
    'plugin svc lists operation svc/restart at x-svc://, which is not served: an earlier entry has its id',
    'plugin svc requires svc:stop for svc/stop, which no entry of ahpd.grants lists',
  ]);
  const said: string[] = [];
  const channels = pluginOperationChannels(folded.options.channels, { onProblem: (line) => { said.push(line); } });
  expect(channels['x-svc://']!.operations().map((one) => one.id)).toEqual(['svc/restart', 'svc/stop']);
  expect(said).toEqual(folded.problems.slice(0, 2));
});

it('refuses a call naming the plugin when its list throws, and reports it at the load', async () => {
  const { host: plugin, contribution } = pluginHost('svc', context());
  plugin.registerChannel('x-svc', { grant: 'svc:read', snapshot: () => ({}), operations: { operations: () => { throw new Error('config unreadable'); }, run: async () => ({}) } });
  const folded = foldHostOptions({ path: root, agents: [{ ...echo({ path: root, pace: 0 }), provider: 'base', displayName: 'Base' }], resources: fileResources() }, [contribution]);
  expect(folded.problems).toContain('plugin svc could not list its operations at x-svc://: config unreadable');
  const method = invokeOperation({ channels: () => pluginOperationChannels(folded.options.channels), check: () => {} });
  await expect(method.handle({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'web' } }, undefined, 'c1'))
    .rejects.toThrow(/^plugin svc could not list its operations at x-svc:\/\/$/);
  // The list is read before any grant is, so its words are the log's and not a caller's.
  const said: string[] = [];
  const told = invokeOperation({ channels: () => pluginOperationChannels(folded.options.channels, { onProblem: (line) => { said.push(line); } }), check: () => {} });
  expect(await told.authorize!({ channel: 'x-svc://', operationId: 'svc/restart' }, holding([]))).toBe(false);
  expect(said).toEqual(['plugin svc could not list its operations at x-svc://: config unreadable']);
});

it.each([
  ['throws', () => { throw new Error('told badly'); }],
  ['rejects', async () => { throw new Error('told badly'); }],
])('answers what run answered when begin and settle %s, and says so', async (_how, bad) => {
  const said: string[] = [];
  let runs = 0;
  const side = { operations: () => [RESTART], begin: bad, settle: bad, run: async (_operation: Operation, target?: string) => { runs += 1; if (target === 'db') throw new Error('unit not found'); return { restarted: target }; } };
  const method = invokeOperation({
    channels: () => pluginOperationChannels({ 'x-svc': { by: 'svc', channel: { grant: 'svc:read', snapshot: () => ({}), operations: side } } }, { onProblem: (line) => { said.push(line); } }),
    check: () => {},
  });
  expect(await method.handle({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'web' } }, undefined, 'c1')).toEqual({ restarted: 'web' });
  await new Promise((done) => { setTimeout(done, 0); });
  expect(runs).toBe(1);
  expect(said).toEqual([
    'plugin svc failed in begin of its operations at x-svc://: told badly',
    'plugin svc failed in settle of its operations at x-svc://: told badly',
  ]);
  await expect(method.handle({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'db' } }, undefined, 'c1')).rejects.toThrow('unit not found');
});

it.each([
  ['no scopes', { scopes: [] }, 'its scopes are not a list of names'],
  ['no kind', { kind: undefined }, 'it has no kind'],
  ['a label that is not text', { label: 3 }, 'its label is not text'],
  ['an input that is not a schema', { input: 'name' }, 'its input is not a JSON Schema object'],
])('leaves out an operation with %s', (_what, over, why) => {
  const said: string[] = [];
  const side = { operations: () => [{ ...RESTART, ...over } as unknown as Operation], run: async () => ({}) };
  const channels = pluginOperationChannels({ 'x-svc': { by: 'svc', channel: { grant: 'svc:read', snapshot: () => ({}), operations: side } } }, { onProblem: (line) => { said.push(line); } });
  expect(channels['x-svc://']!.operations()).toEqual([]);
  expect(said).toEqual([`plugin svc lists operation svc/restart at x-svc://, which is not served: ${why}`]);
});

it('cannot offer operations on a scheme of the daemon\'s own', () => {
  const { host: rogue, contribution } = pluginHost('rogue', context());
  rogue.registerGrants('rogue', { operations: ['go'] });
  rogue.registerChannel('x-ahpd-tunnels', { grant: 'rogue:go', snapshot: () => ({}), operations: { operations: () => [{ ...RESTART, grant: 'rogue:go' }], run: async () => ({}) } });
  const own: PluginChannel = { grant: 'tunnel:read', snapshot: () => ({}) };
  const folded = foldHostOptions({
    path: root,
    agents: [{ ...echo({ path: root, pace: 0 }), provider: 'base', displayName: 'Base' }],
    resources: fileResources(),
    channels: { 'x-ahpd-tunnels': { by: 'ahpd', scheme: 'x-ahpd-tunnels', channel: own } },
  }, [contribution]);
  expect(folded.options.channels!['x-ahpd-tunnels']!.channel).toBe(own);
  expect(pluginOperationChannels(folded.options.channels)).toEqual({});
});

it('admits at the gate a caller holding the operation\'s grant', async () => {
  const one = served();
  expect(await one.method.authorize!({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'web' } }, holding(['svc:restart']))).toBe(true);
});

it('runs a plugin channel\'s operation through invokeOperation for a reader holding its grant', async () => {
  const one = served();
  const answer = await one.method.handle({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'web' } }, holding(['svc:restart']), 'c1');
  expect(answer).toEqual({ restarted: 'web' });
  expect(one.ran).toEqual([{ id: 'svc/restart', target: 'web', reader: 'ana' }]);
  expect(one.settled).toEqual([{ id: 'svc/restart', target: 'web' }]);
});

it('refuses a reader without the operation\'s grant, at the gate and at the call', async () => {
  const one = served();
  const params = { channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'web' } };
  expect(await one.method.authorize!(params, holding(['svc:read']))).toBe(false);
  await expect(one.method.handle(params, holding(['svc:read']), 'c1')).rejects.toThrow('svc:restart');
  expect(one.ran).toEqual([]);
});

it('refuses an operation the plugin did not offer', async () => {
  const one = served();
  await expect(one.method.handle({ channel: 'x-svc://', operationId: 'svc/delete', target: { id: 'web' } }, undefined, 'c1'))
    .rejects.toThrow('No operation called svc/delete on x-svc://');
  await expect(one.method.handle({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'db' } }, undefined, 'c1'))
    .rejects.toThrow('svc/restart is not offered on db now');
  expect(one.ran).toEqual([]);
});

it('settles a failed run with its error', async () => {
  const one = served({ run: async () => { throw new Error('unit not found'); } });
  await expect(one.method.handle({ channel: 'x-svc://', operationId: 'svc/restart', target: { id: 'web' } }, undefined, 'c1'))
    .rejects.toThrow('unit not found');
  expect(one.settled).toEqual([{ id: 'svc/restart', target: 'web', error: 'unit not found' }]);
});

it('refuses a registration whose operations side is not an object, or is missing a function', () => {
  const { host: plugin } = pluginHost('svc', context());
  plugin.registerGrants('svc', { operations: ['restart'] });
  expect(() => plugin.registerChannel('x-svc', {
    grant: 'svc:read',
    snapshot: () => ({}),
    operations: { operations: () => [], begin: () => {}, settle: () => {} } as unknown as NonNullable<PluginChannel['operations']>,
  })).toThrow('operations.run');
  expect(() => plugin.registerChannel('x-svc2', {
    grant: 'svc:read',
    snapshot: () => ({}),
    operations: 'restart' as unknown as NonNullable<PluginChannel['operations']>,
  })).toThrow('operations');
  expect(() => plugin.registerChannel('x-svc3', {
    grant: 'svc:read',
    snapshot: () => ({}),
    operations: { operations: () => [], run: async () => ({}), begin: 'yes' } as unknown as NonNullable<PluginChannel['operations']>,
  })).toThrow('operations.begin');
});
