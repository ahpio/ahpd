import { loggerOf } from '../src/log.js';
import { expect, it } from 'vitest';
import { foldHostOptions, pluginHost } from '../src/plugins/plugins.js';
import { sdkVersion } from '../src/version.js';
import type { Connector } from '../src/types/connectors.js';
import type { LoaderContext, ServedChannel } from '../src/types/plugin.js';

/*
 * The Desk case end to end: a plugin adds each connector of its adapter as an
 * instance when the host opens it, and removes it in the close `open`
 * answers. The host opens and closes connectors itself; here `open` is called
 * as the host calls it.
 */

const root = '/nonexistent-list-connector-instances';
const context = (): LoaderContext => ({ path: root, paths: [root], version: sdkVersion(), hostName: 'test', configDir: root, log: loggerOf(() => {}), say: () => {} });

it('adds a connector as an instance when it opens, and removes it when it closes', async () => {
  const { host, contribution } = pluginHost('desk', context());
  host.registerList({ name: 'ticket', channel: 'x-ahpd-tickets', title: 'Tickets', instances: true });
  const tickets = host.registerKind({
    channel: 'x-ahpd-tickets', name: 'desk-ticket', title: 'Desk ticket', schema: { type: 'object', properties: { title: { type: 'string' } } },
    rows: { list: (_query, instance) => [{ id: '1', record: { title: `in ${String(instance)}` } }], read: () => undefined },
    invoke: () => undefined,
  });
  host.registerAdapter({
    name: 'desk', title: 'Desk', description: 'A Desk instance.', schema: { type: 'object' }, capabilities: [],
    open: (connector) => {
      tickets.addInstance({ id: connector.id, title: connector.title ?? connector.id, owner: connector.owner });
      return () => { tickets.removeInstance(connector.id); };
    },
  });
  const folded = foldHostOptions({ path: root, agents: [] }, [contribution]);
  const list = folded.options.channels!['x-ahpd-tickets'] as ServedChannel;
  const sent: string[] = [];
  list.publish = (_uri, action) => { sent.push(String(action['type'])); };
  list.subscribers = () => [{ client: 'c1', reader: undefined }];
  await list.channel.snapshot('x-ahpd-tickets://', undefined, 'c1');

  const connector: Connector = { id: 'desk-production', adapter: 'desk', owner: 'host', title: 'Desk', config: {} };
  const close = folded.options.adapters!['desk']!.open(connector);
  const settle = async (): Promise<void> => { for (let n = 0; n < 10; n += 1) await Promise.resolve(); };
  await settle();
  const state = await list.channel.snapshot('x-ahpd-tickets://', undefined, 'c1') as { records: { instance: string }[]; instances: { id: string }[] };
  expect(state.instances.map((one) => one.id)).toEqual(['desk-production']);
  expect(state.records.map((one) => one.instance)).toEqual(['desk-production']);
  expect(sent).toContain('x-ahpd-tickets/added');

  sent.length = 0;
  if (typeof close === 'function') await close();
  await settle();
  expect(sent).toContain('x-ahpd-tickets/removed');
  expect((await list.channel.snapshot('x-ahpd-tickets://', undefined, 'c1') as { records: unknown[] }).records).toEqual([]);
});
