import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { WAIT_MS } from '../../../tools/wait.ts';
import { call, directory, file, host, root, withRole } from './users-gate-helpers.js';

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

/*
 * A session's channel shows the comments made outside any session on files
 * under its folder, and only to a reader who may read those files, as the
 * file's own channel asks: in its snapshot, and in each comment said later.
 */
it('shows the comments on a file in a session only to a reader with file:get', async () => {
  const session = ['session:read', 'session:write', 'session:review'] as const;
  const made = host({ users: directory({ reader: [...session, 'file:read', 'file:comment'], blind: [...session] }) });
  // URIs from `pathToFileURL`, which the host's own folder URIs match on Windows too.
  const fileUri = pathToFileURL(file).href;
  const onFile = `x-ahpd-annotations:${fileUri}`;
  const reader = await withRole(made, 'reader');
  const blind = await withRole(made, 'blind');
  for (const [one, name] of [[reader, 'reader'], [blind, 'blind']] as const) {
    expect(await call(one.client, 'createSession', { channel: `ahp-session:/${name}`, provider: 'base', workingDirectories: [pathToFileURL(root).href] })).toHaveProperty('result');
  }

  expect(await call(reader.client, 'subscribe', { channel: onFile })).toHaveProperty('result');
  await reader.send(onFile, { ...comment(onFile), annotation: { ...comment(onFile).annotation, resource: fileUri } });
  await until(() => reader.seen.seen.some((one) => one.method === 'action' && one.params.channel === onFile), 'the comment');

  const opened = async (one: typeof reader, name: string) =>
    ((await call(one.client, 'subscribe', { channel: `ahp-session:/${name}/annotations` })) as { result: { snapshot: { state: { annotations: { id: string }[] } } } })
      .result.snapshot.state.annotations.map((a) => a.id);
  expect(await opened(reader, 'reader')).toEqual(['c1']);
  expect(await opened(blind, 'blind')).toEqual([]);

  // A reply said later reaches the reader's session and not the other one.
  await reader.send(onFile, { type: 'annotations/entrySet', annotationId: 'c1', entry: { id: 'c1-2', text: 'And more' } });
  const said = (one: typeof reader, name: string) => one.seen.seen.some((note) => note.method === 'action'
    && note.params.channel === `ahp-session:/${name}/annotations` && (note.params.action as { type: string }).type === 'annotations/entrySet');
  await until(() => said(reader, 'reader'), 'the reply in the reader\'s session');
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(said(blind, 'blind')).toBe(false);
});
