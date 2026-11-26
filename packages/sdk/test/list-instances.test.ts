import { loggerOf } from '../src/log.js';
import { expect, it } from 'vitest';
import { invokeOperation, pluginOperationChannels } from '../src/kinds/operations.js';
import { foldHostOptions, pluginHost } from '../src/plugins/plugins.js';
import { sdkVersion } from '../src/version.js';
import type { ListKindHandle, ListRow } from '../src/types/lists.js';
import type { LoaderContext, ServedChannel } from '../src/types/plugin.js';
import type { Principal } from '../src/types/users.js';

/*
 * A list with instances: a tickets list whose Desk kind has one instance per
 * connector. Two instances hold a ticket with the same number, a team's
 * instance is read by its team only, and an instance that goes takes its rows
 * with it.
 */

const root = '/nonexistent-list-instances';
const context = (): LoaderContext => ({ path: root, paths: [root], version: sdkVersion(), hostName: 'test', configDir: root, log: loggerOf(() => {}), say: () => {} });
const reader = (id: string, memberships: string[] = []): Principal => ({ id, roles: [], memberships, can: (grant: string) => ['ticket:get', 'ticket:put'].includes(grant) });

function served() {
  const tickets: Record<string, ListRow[]> = {
    prod: [{ id: '18432', record: { title: 'Ramal', status: 'open' } }],
    staging: [{ id: '18432', record: { title: 'Teste', status: 'open' } }],
  };
  const invoked: string[] = [];
  let handle: ListKindHandle | undefined;
  const { host, contribution } = pluginHost('desk', context());
  host.registerList({ name: 'ticket', channel: 'x-ahpd-tickets', title: 'Tickets', instances: true, filters: [{ field: 'status', type: 'enum' }] });
  handle = host.registerKind({
    channel: 'x-ahpd-tickets', name: 'desk-ticket', title: 'Desk ticket',
    schema: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string', enum: ['open', 'closed'] } } },
    operations: [{ id: 'close', label: 'Close' }],
    rows: {
      list: (_query, instance) => tickets[instance ?? ''] ?? [],
      read: (id, instance) => (tickets[instance ?? ''] ?? []).find((one) => one.id === id),
    },
    invoke: (operation, row) => {
      invoked.push(`${operation} ${row?.instance}/${row?.id}`);
      if (operation === 'close' && row !== undefined) {
        tickets[row.instance!] = tickets[row.instance!]!.map((one) => (one.id === row.id ? { ...one, record: { ...one.record, status: 'closed' } } : one));
        handle!.changed(row.instance, row.id);
      }
      return undefined;
    },
  });
  handle.addInstance({ id: 'prod', title: 'Desk', owner: 'host' });
  handle.addInstance({ id: 'staging', title: 'Desk staging', owner: 'team:qa' });
  const folded = foldHostOptions({ path: root, agents: [], grants: { operation: { operations: ['invoke'] } } }, [contribution]);
  expect(folded.problems).toEqual([]);
  const list = folded.options.channels!['x-ahpd-tickets'] as ServedChannel;
  const sent: { uri: string; action: Record<string, unknown> }[] = [];
  const watching = new Set<string>();
  list.publish = (uri, action, options) => { if (options.visible === undefined || options.visible(undefined, 'c1')) sent.push({ uri, action }); };
  list.subscribers = (uri) => (watching.has(uri) ? [{ client: 'c1', reader: undefined }] : []);
  const subscribe = async (uri: string, who?: Principal) => {
    const state = await list.channel.snapshot(uri, who, 'c1') as { records: { id: string; instance?: string; record: Record<string, unknown> }[]; instances?: { id: string }[] };
    watching.add(uri);
    return state;
  };
  const method = invokeOperation({ channels: () => pluginOperationChannels(folded.options.channels), check: () => {} });
  const invoke = (operationId: string, extra: Record<string, unknown>) => method.handle({ channel: 'x-ahpd-tickets://', operationId, ...extra }, undefined, 'c1');
  const settle = async (): Promise<void> => { for (let n = 0; n < 10; n += 1) await Promise.resolve(); };
  return { folded, list, subscribe, invoke, invoked, sent, settle, handle, tickets };
}

it('answers the rows of every instance, each named by its instance, with the instances listed', async () => {
  const { subscribe } = served();
  const state = await subscribe('x-ahpd-tickets://');
  expect(state.records.map((one) => `${one.instance}/${one.id}`).sort()).toEqual(['prod/18432', 'staging/18432']);
  expect(state.instances?.map((one) => one.id)).toEqual(['prod', 'staging']);
  const one = await subscribe('x-ahpd-tickets://?instance=staging');
  expect(one.records.map((row) => row.record['title'])).toEqual(['Teste']);
});

it('shows a team\'s instance to its members only, and the host\'s to every reader of the list', async () => {
  const { subscribe } = served();
  const outsider = await subscribe('x-ahpd-tickets://', reader('bo'));
  expect(outsider.records.map((one) => one.instance)).toEqual(['prod']);
  expect(outsider.instances?.map((one) => one.id)).toEqual(['prod']);
  const member = await subscribe('x-ahpd-tickets://', reader('ana', ['qa']));
  expect(member.records.map((one) => one.instance).sort()).toEqual(['prod', 'staging']);
});

it('runs an operation on <instance>/<id>, handing the kind the row with its instance', async () => {
  const { invoke, invoked, subscribe, sent, settle } = served();
  await subscribe('x-ahpd-tickets://?status=open');
  const answer = await invoke('desk-ticket/close', { target: { id: 'staging/18432' } }) as Record<string, unknown>;
  expect(answer).toMatchObject({ id: '18432', instance: 'staging', record: { status: 'closed' } });
  expect(invoked).toEqual(['close staging/18432']);
  await settle();
  expect(sent.filter((one) => one.action['type'] === 'x-ahpd-tickets/removed').map((one) => one.action)).toEqual([{ type: 'x-ahpd-tickets/removed', id: '18432', instance: 'staging' }]);
});

it('reads one row at ticket://<instance>/<id>', async () => {
  const { folded } = served();
  const read = await folded.options.resourceProviders!['ticket']!.read('ticket://prod/18432');
  expect(JSON.parse(String(read.data))).toMatchObject({ id: '18432', instance: 'prod', record: { title: 'Ramal' } });
  await expect(folded.options.resourceProviders!['ticket']!.read('ticket://gone/18432')).rejects.toThrow();
});

it('sends the rows of an instance that came, and removes those of one that went', async () => {
  const { subscribe, handle, tickets, sent, settle } = served();
  await subscribe('x-ahpd-tickets://');
  tickets['dev'] = [{ id: '7', record: { title: 'New', status: 'open' } }];
  handle.addInstance({ id: 'dev', title: 'Desk dev' });
  await settle();
  expect(sent.some((one) => one.action['type'] === 'x-ahpd-tickets/added' && one.action['instance'] === 'dev')).toBe(true);
  expect(sent.some((one) => one.action['type'] === 'x-ahpd-tickets/instances')).toBe(true);
  sent.length = 0;
  handle.removeInstance('prod');
  await settle();
  expect(sent.filter((one) => one.action['type'] === 'x-ahpd-tickets/removed').map((one) => one.action)).toEqual([{ type: 'x-ahpd-tickets/removed', id: '18432', instance: 'prod' }]);
});

it('refuses an instance id with a slash, and an instance on a list without instances', () => {
  const { handle } = served();
  expect(() => handle.addInstance({ id: 'a/b', title: 'x' })).toThrow(/addInstance.*no slash/);
  const { host, contribution } = pluginHost('todos', context());
  host.registerList({ name: 'todo', channel: 'x-ahpd-todos', title: 'Todos' });
  const todo = host.registerKind({ channel: 'x-ahpd-todos', name: 'todo', title: 'Todo', schema: { type: 'object' }, rows: { list: () => [], read: () => undefined }, invoke: () => undefined });
  foldHostOptions({ path: root, agents: [] }, [contribution]);
  expect(() => todo.addInstance({ id: 'x', title: 'x' })).toThrow(/addInstance.*x-ahpd-todos has none/);
});
