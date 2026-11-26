import { loggerOf } from '../src/log.js';
import { expect, it } from 'vitest';
import { invokeOperation, pluginOperationChannels } from '../src/kinds/operations.js';
import { PROCESSES_SCHEME } from '../src/lists/processes.js';
import { foldHostOptions, pluginHost } from '../src/plugins/plugins.js';
import { sdkVersion } from '../src/version.js';
import type { ListProcess, ListRow } from '../src/types/lists.js';
import type { Contribution, LoaderContext, PluginHost, ServedChannel } from '../src/types/plugin.js';
import type { Principal } from '../src/types/users.js';

/*
 * Operations a plugin adds onto lists it did not register: a services list
 * with two kinds from two plugins, a deploy plugin that adds a long deploy
 * onto both and keeps its own processes, and a backup plugin that adds an
 * export onto the list as a whole.
 */

const root = '/nonexistent-list-added-operations';
const context = (): LoaderContext => ({ path: root, paths: [root], version: sdkVersion(), hostName: 'test', configDir: root, log: loggerOf(() => {}), say: () => {} });
const holding = (grants: string[]): Principal => ({ id: 'ana', roles: [], can: (grant: string) => grants.includes(grant) });

const plugin = (by: string, register: (host: PluginHost) => void): Contribution => {
  const { host, contribution } = pluginHost(by, context());
  register(host);
  return contribution;
};

const services = (name: string, rows: ListRow[], own: string[] = []) => plugin(name, (host) => {
  if (name === 'compose') host.registerList({ name: 'service', channel: 'x-ahpd-services', title: 'Services' });
  host.registerKind({
    channel: 'x-ahpd-services', name, title: name,
    schema: { type: 'object', properties: { name: { type: 'string' }, deploy: { type: 'object' } } },
    operations: own.map((id) => ({ id })),
    rows: { list: () => rows, read: (id) => rows.find((one) => one.id === id) },
    invoke: () => undefined,
  });
});

function served(extra: Contribution[] = []) {
  const ran: string[] = [];
  const deploys = new Map<string, ListProcess>();
  const deploy = plugin('@acme/deploy', (host) => {
    const handle = host.registerOperation({
      channel: 'x-ahpd-services',
      kinds: ['compose', 'systemd'],
      operation: { id: 'deploy', label: 'Deploy', long: true, grant: 'service:deploy', offered: (record) => record['deploy'] !== undefined },
      processes: { list: () => [...deploys.values()], read: (id) => deploys.get(id) },
      invoke: async (row, input, work) => {
        ran.push(`deploy ${row!.id} ${String(input?.['version'])}`);
        deploys.set(work!.id, { id: work!.id, origin: { row: row!.id, operation: 'deploy' }, lifecycle: 'completed' });
        handle.processChanged(work!.id);
      },
    });
  });
  const backup = plugin('backup', (host) => {
    host.registerOperation({
      channel: 'x-ahpd-services',
      operation: { id: 'export', label: 'Export' },
      invoke: () => { ran.push('export'); },
    });
  });
  const folded = foldHostOptions({ path: root, agents: [], grants: { operation: { operations: ['invoke'] }, service: { operations: ['deploy'] } } }, [
    services('compose', [{ id: 'web', record: { name: 'web', deploy: {} } }, { id: 'db', record: { name: 'db' } }]),
    services('systemd', [{ id: 'nginx', record: { name: 'nginx', deploy: {} } }]),
    deploy,
    backup,
    ...extra,
  ]);
  const method = invokeOperation({ channels: () => pluginOperationChannels(folded.options.channels), check: () => {} });
  const invoke = (operationId: string, extra2: Record<string, unknown> = {}) =>
    method.handle({ channel: 'x-ahpd-services://', operationId, ...extra2 }, holding(['service:deploy', 'service:put']), 'c1');
  const list = folded.options.channels!['x-ahpd-services'] as ServedChannel;
  const settle = async (): Promise<void> => { for (let n = 0; n < 10; n += 1) await Promise.resolve(); };
  return { folded, invoke, list, ran, settle };
}

it('lists a deploy onto two kinds as two ids, offered by its own offered, and an export on the list', async () => {
  const { folded, list } = served();
  expect(folded.problems).toEqual([]);
  const ids = (list.channel.operations!.operations() as { id: string }[]).map((one) => one.id);
  expect(ids).toEqual(expect.arrayContaining(['compose/deploy', 'systemd/deploy', 'backup/export']));
  const state = await list.channel.snapshot('x-ahpd-services://', undefined, 'c1') as { records: { id: string; operations: string[] }[] };
  const offered = Object.fromEntries(state.records.map((one) => [one.id, one.operations]));
  expect(offered['web']).toContain('compose/deploy');
  expect(offered['db']).not.toContain('compose/deploy');
  expect(offered['nginx']).toContain('systemd/deploy');
  expect(list.channel.listOperations!()).toEqual([{ id: 'backup/export', label: 'Export', scopes: ['list'], grant: 'service:put' }]);
});

it('runs a long deploy as a process the deploy plugin keeps, and an export with no target', async () => {
  const { invoke, ran, settle, folded } = served();
  const answer = await invoke('systemd/deploy', { target: { id: 'nginx' }, input: { version: '1.2' } }) as { process: string };
  expect(answer.process).toMatch(/^x-ahpd-processes:\/\/x-ahpd-services\/deploy\//);
  await settle();
  expect(ran).toEqual(['deploy nginx 1.2']);
  const processes = folded.options.channels![PROCESSES_SCHEME] as ServedChannel;
  expect(await processes.channel.snapshot(answer.process, undefined, 'c1')).toMatchObject({ process: { lifecycle: 'completed', origin: { row: 'nginx', operation: 'deploy' } } });

  expect(await invoke('backup/export')).toEqual({});
  expect(ran).toEqual(['deploy nginx 1.2', 'export']);
});

it('refuses a deploy on a row its offered leaves out', async () => {
  const { invoke } = served();
  await expect(invoke('compose/deploy', { target: { id: 'db' } })).rejects.toThrow(/not offered on db/);
});

it('reports an added id a kind already has, and keeps the kind\'s own', () => {
  const clash = plugin('@acme/deploy-two', (host) => {
    host.registerOperation({ channel: 'x-ahpd-services', kinds: ['compose'], operation: { id: 'restart' }, invoke: () => undefined });
  });
  const folded = foldHostOptions({ path: root, agents: [], grants: { operation: { operations: ['invoke'] } } }, [
    services('compose', [], ['restart']),
    clash,
  ]);
  expect(folded.problems).toContain('plugin @acme/deploy-two adds operation compose/restart, which kind compose of plugin compose already has; the kind\'s own stays');
});

it('refuses a long added operation with no processes', () => {
  const { host } = pluginHost('bad', context());
  expect(() => host.registerOperation({ channel: 'x-ahpd-services', operation: { id: 'go', long: true }, invoke: () => undefined })).toThrow(/registerOperation.*processes/);
});
