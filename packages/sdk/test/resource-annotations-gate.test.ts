import { expect, it } from 'vitest';
import { WAIT_MS } from '../../../tools/wait.ts';
import { call, directory, file, host, withRole } from './users-gate-helpers.js';

/*
 * Who may comment on a resource: a reader with `file:comment`, which the read
 * group holds; nobody without it.
 */

const until = async (what: () => boolean, why: string): Promise<void> => {
  const stop = Date.now() + WAIT_MS;
  while (Date.now() < stop) {
    if (what()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  throw new Error(`Timed out waiting for ${why}`);
};

const comment = (channel: string) => ({
  type: 'annotations/set',
  annotation: {
    id: 'c1', origin: { session: channel }, resource: `file://${file}`, resolved: false,
    entries: [{ id: 'c1-1', text: 'A note' }],
  },
});

it('lets a reader comment, and refuses one without file:comment', async () => {
  const made = host({ users: directory({ r: ['file:read'], n: ['file:get'] }) });
  const channel = `x-ahpd-annotations:file://${file}`;

  const reader = await withRole(made, 'r');
  expect(await call(reader.client, 'subscribe', { channel })).toHaveProperty('result');
  await reader.send(channel, comment(channel));
  await until(() => reader.seen.seen.some((one) => one.method === 'action' && (one.params.action as { type: string }).type === 'annotations/set'), 'the comment');
  expect(reader.refused()).toEqual([]);

  const other = await withRole(made, 'n');
  expect(await call(other.client, 'subscribe', { channel })).toHaveProperty('result');
  await other.send(channel, comment(channel));
  await until(() => other.refused().length > 0, 'the refusal');
  expect(other.refused()).toEqual([`${channel}: n may not file:comment here`]);
});
