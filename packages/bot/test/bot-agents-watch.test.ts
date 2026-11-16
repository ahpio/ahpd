import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { agentsWatch } from '../src/agentswatch.js';
import type { BotRecord } from '../src/record.js';
import type { ResourceStore } from '../../sdk/src/types/resources.js';

/*
 * Which bots' `AGENTS.md` is watched: a local bot's workspace folder, for that
 * one name, again when the workspace moves, and never for a bot in a machine.
 */

const bot = (id: string, extra: Partial<BotRecord> = {}): BotRecord => ({
  id, name: id, labels: [], body: 'robot', color: 'red', workspace: `/bots/${id}`, owner: 'user:ana',
  createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z', ...extra,
} as BotRecord);

/** A watch that keeps what it was asked, and fires on demand. */
const fake = (missing: string[] = []) => {
  const opened: { uri: string; options: unknown; fire: () => void; closed: boolean }[] = [];
  const watch: NonNullable<ResourceStore['watch']> = async (uri, options, onChange) => {
    if (missing.some((one) => uri.endsWith(one))) throw new Error('Nothing there');
    const one = { uri, options, fire: () => { onChange([{ uri: `${uri}/AGENTS.md`, type: 'updated' }]); }, closed: false };
    opened.push(one);
    return { close: () => { one.closed = true; } };
  };
  return { opened, watch };
};

/** A workspace's URI as the watch is asked it: a drive letter on Windows. */
const at = (path: string): string => pathToFileURL(path).href;

const settled = async (): Promise<void> => { await new Promise((done) => { setTimeout(done, 0); }); };

it('watches a local bot\'s folder for AGENTS.md, and says which bot moved', async () => {
  const { opened, watch } = fake();
  const told: string[] = [];
  const watches = agentsWatch(watch, (slug) => { told.push(slug); });
  watches.follow(bot('motion'));
  watches.follow(bot('motion'));
  watches.follow(bot('remote', { computer: 'box' }));
  await settled();

  expect(opened.map((one) => [one.uri, one.options])).toEqual([[at('/bots/motion'), { recursive: false, includes: ['AGENTS.md'] }]]);
  opened[0]?.fire();
  expect(told).toEqual(['motion']);
});

it('watches again where the workspace moved, and stops on drop and close', async () => {
  const { opened, watch } = fake();
  const watches = agentsWatch(watch, () => {});
  watches.follow(bot('motion'));
  await settled();
  watches.follow(bot('motion', { workspace: '/elsewhere/motion' }));
  await settled();
  expect(opened.map((one) => `${one.uri} ${one.closed}`)).toEqual([`${at('/bots/motion')} true`, `${at('/elsewhere/motion')} false`]);

  watches.follow(bot('other'));
  watches.drop('motion');
  // Dropped before its watch opened: closed as soon as it does.
  watches.follow(bot('late'));
  watches.drop('late');
  await settled();
  watches.close();
  expect(opened.every((one) => one.closed)).toBe(true);
});

it('asks again at the next change when the folder was not there, and watches nothing without a store watch', async () => {
  const missing = ['/bots/new'];
  const { opened, watch } = fake(missing);
  const watches = agentsWatch(watch, () => {});
  watches.follow(bot('new'));
  await settled();
  expect(opened).toEqual([]);
  // The folder is made, and the bot's next change asks again for the same one.
  missing.length = 0;
  watches.follow(bot('new'));
  await settled();
  expect(opened.map((one) => one.uri)).toEqual([at('/bots/new')]);

  const none = agentsWatch(undefined, () => {});
  none.follow(bot('motion'));
  none.close();
});
