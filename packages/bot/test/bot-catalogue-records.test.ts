import { expect, it } from 'vitest';
import { botCatalogue } from '../src/catalogue.js';
import type { BotRecord } from '../src/record.js';
import type { BotStore } from '../src/store.js';
import type { ChannelHandle, PublishOptions } from '../../sdk/src/types/plugin.js';
import type { Principal } from '../../sdk/src/types/users.js';

/*
 * The record each reader of `x-ahpd-bots://` is sent: one for each person who
 * talks to the bot, with their `session`, and one for every other reader.
 */

const bot: BotRecord = {
  id: 'motion', name: 'Motion', labels: [], body: 'robot', color: 'red',
  workspace: '/bots/motion', owner: 'team:crew',
  createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z',
} as BotRecord;

const person = (id: string): Principal => ({ id, roles: [], can: () => false, memberships: ['crew'] } as unknown as Principal);
const ana = person('ana');
const bo = person('bo');

const store = { ready: async () => {}, all: () => [bot], get: (slug: string) => (slug === bot.id ? bot : undefined) } as unknown as BotStore;

/** A catalogue whose bot ana talks to, and every action it publishes. */
const catalogue = () => {
  const sent: { action: Record<string, unknown>; options: PublishOptions }[] = [];
  const handle: ChannelHandle = {
    publish: (_uri, action, options = {}) => { sent.push({ action, options }); },
    subscribers: () => [{ client: 'a', reader: ana }, { client: 'b', reader: bo }],
  };
  const made = botCatalogue(store, {
    record: (one) => ({ ...one, instructions: 'From AGENTS.md' }),
    talks: async () => new Map([['user:ana', 'ahp-session:/ana-talk']]),
    talker: (reader) => (reader === undefined ? 'root' : `user:${reader.id}`),
  });
  made.bind(handle);
  /** What one reader on one client sees of everything sent, as `type session`. */
  const seen = (reader: Principal, client: string): string[] => sent
    .filter((one) => one.options.visible?.(reader, client) ?? true)
    .map((one) => `${String(one.action.type)} ${String((one.action.record as Record<string, unknown> | undefined)?.session ?? '-')}`);
  return { made, seen };
};

it('answers each reader the bot with its own talk', async () => {
  const { made } = catalogue();
  const snapshot = async (reader: Principal, client: string) => await made.channel.snapshot?.('x-ahpd-bots://', reader, client) as { records: { id: string; record: Record<string, unknown> }[] };

  expect((await snapshot(ana, 'a')).records).toEqual([
    { id: 'motion', record: { ...bot, instructions: 'From AGENTS.md', session: 'ahp-session:/ana-talk' } },
  ]);
  expect((await snapshot(bo, 'b')).records).toEqual([{ id: 'motion', record: { ...bot, instructions: 'From AGENTS.md' } }]);
});

it('sends an edit to each reader with their own talk, and a new talk to its person alone', async () => {
  const { made, seen } = catalogue();
  await made.channel.snapshot?.('x-ahpd-bots://', ana, 'a');
  await made.channel.snapshot?.('x-ahpd-bots://', bo, 'b');

  made.put({ ...bot, name: 'Motion two' }, bot);
  made.talked('motion', 'user:bo', 'ahp-session:/bo-talk');
  // The same talk again is no change.
  made.talked('motion', 'user:bo', 'ahp-session:/bo-talk');

  expect(seen(ana, 'a')).toEqual(['x-ahpd-bots/changed ahp-session:/ana-talk']);
  expect(seen(bo, 'b')).toEqual(['x-ahpd-bots/changed -', 'x-ahpd-bots/changed ahp-session:/bo-talk']);
});
