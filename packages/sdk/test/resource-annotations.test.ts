import { WAIT_MS } from '../../../tools/wait.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createHost } from '../src/host.js';
import { fileResources } from '../src/resources/resources.js';
import { echo } from '../../../examples/echo/agent.js';
import type { AnnotationsState } from '@microsoft/agent-host-protocol';
import type { ResourceAnnotationsStore } from '../src/types/host.js';
import type { Peer } from '../src/types/rpc.js';

/*
 * Comments on a resource outside any session, `x-ahpd-annotations:<resource URI>`,
 * against a real folder. Two clients subscribe; what each one sees is the
 * `action` notes its peer collected.
 */

let root: string;
let file: string;
let channel: string;
let shared: string;

interface Note { method: string; params: unknown }
type Envelope = { channel: string; action: Record<string, unknown>; origin?: { clientId: string; clientSeq: number }; rejectionReason?: string };

function peer(): Peer & { notes: Note[] } {
  const notes: Note[] = [];
  return { notes, send: () => {}, notify: (method, params) => notes.push({ method, params }), request: async () => ({}), answered: () => {}, close: () => {} };
}

const until = async (what: () => boolean, why: string): Promise<void> => {
  const stop = Date.now() + WAIT_MS;
  while (Date.now() < stop) {
    if (what()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  throw new Error(`Timed out waiting for ${why}`);
};

const seen = (p: ReturnType<typeof peer>, on = channel): Envelope[] => p.notes
  .filter((n) => n.method === 'action')
  .map((n) => n.params as Envelope)
  .filter((n) => n.channel === on);

const memory = (): ResourceAnnotationsStore & { kept: Map<string, AnnotationsState> } => {
  const kept = new Map<string, AnnotationsState>();
  return { kept, read: (uri) => kept.get(uri), write: (uri, state) => { kept.set(uri, state); }, list: () => [...kept.keys()] };
};

const makeHost = (store = memory()) => createHost({ path: root, agents: [echo({ path: root, pace: 0 })], resources: fileResources(), resourceAnnotations: store });

async function join_(host: ReturnType<typeof makeHost>, clientId: string, channels: string[] = [channel]) {
  const p = peer();
  const client = host.accept(p);
  await client.handle({ method: 'initialize', params: { clientId, protocolVersions: ['0.9.0'], initialSubscriptions: ['ahp-root://'] } });
  const opened: Record<string, { snapshot: { state: Record<string, unknown> } }> = {};
  for (const one of channels) opened[one] = await client.handle({ method: 'subscribe', params: { channel: one } }) as never;
  let seq = 0;
  const send = (action: Record<string, unknown>, on = channel): void => {
    seq += 1;
    void client.handle({ method: 'dispatchAction', params: { channel: on, clientSeq: seq, action } });
  };
  return { client, peer: p, opened, send };
}

const comment = (id: string, text: string, range = { start: { line: 1, character: 2 }, end: { line: 1, character: 5 } }) => ({
  type: 'annotations/set',
  annotation: {
    id,
    origin: { session: channel },
    resource: `file://${file}`,
    range,
    resolved: false,
    entries: [{ id: `${id}-1`, text, _meta: { 'vscode.agentFeedback': { author: 'user' }, ahpd: { by: 'user:someone-else', name: 'forged' } } }],
    _meta: { 'vscode.agentFeedback': { kind: 'user', state: 'created', sessionResource: channel } },
  },
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ahpd-notes-'));
  file = join(root, 'PLAN.md');
  writeFileSync(file, '## Tasks\n- one\n- two\n');
  channel = `x-ahpd-annotations:file://${file}`;
  shared = `x-ahpd-shared:file://${file}`;
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

it('shares a comment, a reply, a resolve and a remove between two clients', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  expect(ana.opened[channel]!.snapshot.state).toEqual({ annotations: [] });

  ana.send(comment('c1', 'Which kind?'));
  await until(() => seen(rafael.peer).some((one) => one.action.type === 'annotations/set'), 'the comment');
  rafael.send({ type: 'annotations/entrySet', annotationId: 'c1', entry: { id: 'c1-2', text: 'The resource kind.' } });
  await until(() => seen(ana.peer).some((one) => one.action.type === 'annotations/entrySet'), 'the reply');
  ana.send({ type: 'annotations/updated', annotationId: 'c1', resolved: true });
  await until(() => seen(rafael.peer).some((one) => one.action.type === 'annotations/updated'), 'the resolve');

  const third = await join_(host, 'third');
  const state = third.opened[channel]!.snapshot.state as unknown as AnnotationsState;
  expect(state.annotations).toHaveLength(1);
  expect(state.annotations[0]).toMatchObject({ id: 'c1', resolved: true });
  expect(state.annotations[0]!.entries.map((one) => one.text)).toEqual(['Which kind?', 'The resource kind.']);

  ana.send({ type: 'annotations/removed', annotationId: 'c1' });
  await until(() => seen(rafael.peer).some((one) => one.action.type === 'annotations/removed'), 'the remove');
  await host.close();
});

it('stamps each new entry with who wrote it and when, whatever the client put there', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  ana.send(comment('c1', 'Mine'));
  await until(() => seen(ana.peer).some((one) => one.action.type === 'annotations/set'), 'the comment');
  const set = seen(ana.peer).find((one) => one.action.type === 'annotations/set')!;
  const stamp = ((set.action.annotation as { entries: { _meta: Record<string, unknown> }[] }).entries[0]!._meta.ahpd) as Record<string, unknown>;
  expect(stamp).toMatchObject({ by: 'guest:ana', name: 'ana guest' });
  expect(typeof stamp.at).toBe('string');
  await host.close();
});

it('refuses an origin that is neither a session of the writer nor the channel', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const forged = comment('c1', 'x');
  (forged.annotation.origin as { session: string }).session = 'ahp-session:/someone-elses';
  ana.send(forged);
  await until(() => seen(ana.peer).some((one) => one.rejectionReason !== undefined), 'the refusal');
  expect(seen(ana.peer).find((one) => one.rejectionReason !== undefined)!.rejectionReason).toMatch(/origin\.session/);
  await host.close();
});

it('keeps the comments in the store, so another host reads them back', async () => {
  const store = memory();
  const first = makeHost(store);
  const ana = await join_(first, 'ana');
  ana.send(comment('c1', 'Kept'));
  await until(() => store.kept.size === 1, 'the store');
  await first.close();
  const second = makeHost(store);
  const rafael = await join_(second, 'rafael');
  expect((rafael.opened[channel]!.snapshot.state as unknown as AnnotationsState).annotations[0]!.id).toBe('c1');
  await second.close();
});

it('moves a range with a live edit before it, and leaves one after it', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana', [channel, shared]);
  // On line 1, "- one": characters 2 to 5 are "one".
  ana.send(comment('c1', 'On one'));
  await until(() => seen(ana.peer).some((one) => one.action.type === 'annotations/set'), 'the comment');
  // A new line at the top of the file.
  ana.send({ type: 'x-ahpd-shared/changed', version: 0, changes: [{ from: 0, to: 0, insert: '# Plan\n' }], ranges: [] }, shared);
  await until(() => seen(ana.peer).some((one) => one.action.type === 'annotations/updated'), 'the move');
  const moved = seen(ana.peer).find((one) => one.action.type === 'annotations/updated')!;
  expect(moved.action.range).toEqual({ start: { line: 2, character: 2 }, end: { line: 2, character: 5 } });
  // An edit after the comment moves nothing.
  const before = seen(ana.peer).length;
  ana.send({ type: 'x-ahpd-shared/changed', version: 1, changes: [{ from: 28, to: 28, insert: '- three\n' }], ranges: [] }, shared);
  await until(() => seen(ana.peer, shared).filter((one) => one.action.type === 'x-ahpd-shared/changed').length === 2, 'the second edit');
  expect(seen(ana.peer).length).toBe(before);
  await host.close();
});

it('makes a comment whose words are deleted an outdated point, and keeps the thread', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana', [channel, shared]);
  ana.send(comment('c1', 'On one'));
  await until(() => seen(ana.peer).some((one) => one.action.type === 'annotations/set'), 'the comment');
  // Delete "one" on line 1: offsets 11 to 14 in "## Tasks\n- one\n- two\n".
  ana.send({ type: 'x-ahpd-shared/changed', version: 0, changes: [{ from: 11, to: 14, insert: '' }], ranges: [] }, shared);
  await until(() => seen(ana.peer).filter((one) => one.action.type === 'annotations/set').length === 2, 'the outdated mark');
  const third = await join_(host, 'third');
  const kept = (third.opened[channel]!.snapshot.state as unknown as AnnotationsState).annotations[0]!;
  expect(kept.range).toEqual({ start: { line: 1, character: 2 }, end: { line: 1, character: 2 } });
  expect(kept._meta?.ahpd).toMatchObject({ outdated: true });
  expect(kept.entries).toHaveLength(1);
  await host.close();
});
