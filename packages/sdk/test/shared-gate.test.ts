import { expect, it } from 'vitest';
import { WAIT_MS } from '../../../tools/wait.ts';
import { call, directory, file, host, withRole } from './users-gate-helpers.js';

const until = async (what: () => boolean, why: string): Promise<void> => {
  const stop = Date.now() + WAIT_MS;
  while (Date.now() < stop) {
    if (what()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  throw new Error(`Timed out waiting for ${why}`);
};

/*
 * Who may open a shared resource and who may change it: a subscribe and a
 * caret are a read of the file, a change is a write to it.
 */

it('lets a reader open the document and send carets, and refuses the reader a change', async () => {
  const made = host({ users: directory({ w: ['file:read', 'file:write'], r: ['file:read'], n: [] }) });
  const channel = `x-ahpd-shared:file://${file}`;

  const writer = await withRole(made, 'w');
  expect(await call(writer.client, 'subscribe', { channel })).toHaveProperty('result');

  const reader = await withRole(made, 'r');
  expect(await call(reader.client, 'subscribe', { channel })).toHaveProperty('result');
  await reader.send(channel, { type: 'x-ahpd-shared/selected', version: 0, ranges: [{ anchor: 1, head: 1 }] });
  await reader.send(channel, { type: 'x-ahpd-shared/changed', version: 0, changes: [{ from: 0, to: 0, insert: 'taken' }], ranges: [] });
  await reader.send(channel, { type: 'x-ahpd-shared/editing', editing: true });
  await until(() => reader.refused().length > 1, 'the refusals');
  expect(reader.refused()).toEqual([`${channel}: r may not file:put here`, `${channel}: r may not file:put here`]);
  // A signed-in person is a user, named by their id.
  const state = await call(writer.client, 'subscribe', { channel }) as { result?: { snapshot: { state: { people: { name: string; kind: string }[] } } } };
  expect(state.result?.snapshot.state.people).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'w', kind: 'user' })]));

  // The writer saw the reader's carets, and the change only as refused, as every refused action is said.
  await until(() => writer.seen.seen.some((one) => one.method === 'action' && (one.params.action as { type: string }).type === 'x-ahpd-shared/selected'), 'the carets');
  const changes = writer.seen.seen.filter((one) => one.method === 'action' && (one.params.action as { type: string }).type === 'x-ahpd-shared/changed');
  expect(changes.every((one) => typeof one.params.rejectionReason === 'string')).toBe(true);

  const nobody = await withRole(made, 'n');
  expect(await call(nobody.client, 'subscribe', { channel })).not.toHaveProperty('result');
});
