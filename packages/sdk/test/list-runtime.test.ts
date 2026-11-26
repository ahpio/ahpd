import { loggerOf } from '../src/log.js';
import { expect, it } from 'vitest';
import { invokeOperation, pluginOperationChannels } from '../src/kinds/operations.js';
import { foldHostOptions, pluginHost } from '../src/plugins/plugins.js';
import { sdkVersion } from '../src/version.js';
import type { ListProcess, ListRow } from '../src/types/lists.js';
import type { LoaderContext, ServedChannel } from '../src/types/plugin.js';
import type { Principal } from '../src/types/users.js';

/*
 * A runtime kind: process-compose services. A person starts a row, which runs
 * as a process until it is stopped; the host starts nothing by itself, and
 * stops what runs when it closes.
 */

const root = '/nonexistent-list-runtime';
const context = (): LoaderContext => ({ path: root, paths: [root], version: sdkVersion(), hostName: 'test', configDir: root, log: loggerOf(() => {}), say: () => {} });
const holding = (grants: string[]): Principal => ({ id: 'ana', roles: [], can: (grant: string) => grants.includes(grant) });

function served() {
  const started: string[] = [];
  const stopped: string[] = [];
  const kept = new Map<string, ListProcess>();
  const rows: ListRow[] = [{ id: 'web', record: { name: 'web', command: 'node web.js' } }];
  const { host, contribution } = pluginHost('compose', context());
  host.registerList({ name: 'service', channel: 'x-ahpd-services', title: 'Services' });
  host.registerKind({
    channel: 'x-ahpd-services', name: 'compose', title: 'process-compose', class: 'runtime',
    schema: { type: 'object', required: ['name'], properties: {
      name: { type: 'string' }, command: { type: 'string' },
      status: { type: 'string', readOnly: true, 'x-ahpd-live': true },
    } },
    rows: { list: () => rows, read: (id) => rows.find((one) => one.id === id) },
    processes: { list: () => [...kept.values()], read: (id) => kept.get(id) },
    invoke: () => undefined,
    start: async (row, process) => {
      started.push(row.id);
      kept.set(process.id, { id: process.id, origin: { row: row.id, operation: 'start' }, lifecycle: 'running' });
      process.report({ line: 'listening on 3000' });
      // A service runs until it is stopped.
      await new Promise<void>((done) => { process.signal.addEventListener('abort', () => { done(); }); });
    },
    stop: (row) => { stopped.push(row.id); },
  });
  const folded = foldHostOptions({ path: root, agents: [], grants: { operation: { operations: ['invoke'] } } }, [contribution]);
  expect(folded.problems).toEqual([]);
  const list = folded.options.channels!['x-ahpd-services'] as ServedChannel;
  const method = invokeOperation({ channels: () => pluginOperationChannels(folded.options.channels), check: () => {} });
  const invoke = (operationId: string, extra: Record<string, unknown> = {}) =>
    method.handle({ channel: 'x-ahpd-services://', operationId, ...extra }, holding(['service:put']), 'c1');
  const row = async () => ((await list.channel.snapshot('x-ahpd-services://', undefined, 'c1')) as { records: { id: string; operations: string[]; process?: { uri: string; lifecycle?: string } }[] }).records[0]!;
  const settle = async (): Promise<void> => { for (let n = 0; n < 10; n += 1) await Promise.resolve(); };
  return { folded, invoke, row, settle, started, stopped };
}

it('starts nothing by itself, and offers start on a row that does not run', async () => {
  const { row, started } = served();
  expect(started).toEqual([]);
  const web = await row();
  expect(web.operations).toEqual(['compose/update', 'compose/remove', 'compose/start']);
  expect(web).not.toHaveProperty('process');
});

it('runs a started row as a process, offers stop while it runs, and stops it', async () => {
  const { invoke, row, settle, started, stopped } = served();
  const { process } = await invoke('compose/start', { target: { id: 'web' } }) as { process: string };
  expect(process).toMatch(/^x-ahpd-processes:\/\/x-ahpd-services\/compose\//);
  await settle();
  expect(started).toEqual(['web']);
  const running = await row();
  expect(running.operations).toContain('compose/stop');
  expect(running.operations).not.toContain('compose/start');
  expect(running.process).toEqual({ uri: process, lifecycle: 'running' });

  expect(await invoke('compose/stop', { target: { id: 'web' } })).toEqual({});
  await settle();
  expect(stopped).toEqual(['web']);
  const after = await row();
  expect(after.operations).toContain('compose/start');
  expect(after.process?.lifecycle).toBe('stopped');
});

it('refuses a create that writes a live field', async () => {
  const { invoke } = served();
  await expect(invoke('compose/create', { input: { name: 'api', status: 'running' } })).rejects.toThrow(/status is live/);
});

it('stops each running row when the host closes', async () => {
  const { invoke, folded, settle, stopped } = served();
  await invoke('compose/start', { target: { id: 'web' } });
  await settle();
  for (const one of folded.options.closers ?? []) await one.close();
  expect(stopped).toEqual(['web']);
});

it('refuses a runtime kind without start, stop or processes', () => {
  const { host } = pluginHost('bad', context());
  const base = {
    channel: 'x-ahpd-services', name: 'bad', title: 'Bad', class: 'runtime' as const, schema: { type: 'object' },
    rows: { list: () => [], read: () => undefined }, invoke: () => undefined,
    processes: { list: () => [], read: () => undefined },
  };
  expect(() => host.registerKind({ ...base, stop: () => undefined })).toThrow(/registerKind.*start/);
  const { processes: _processes, ...noProcesses } = base;
  expect(() => host.registerKind({ ...noProcesses, name: 'bad-2', start: () => undefined, stop: () => undefined })).toThrow(/registerKind.*processes/);
});
