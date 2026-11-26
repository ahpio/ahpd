import { WAIT_MS } from '../../../tools/wait.ts';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createHost } from '../src/host.js';
import { fileResources } from '../src/resources/resources.js';
import { echo } from '../../../examples/echo/agent.js';
import { SHARED_LOG } from '../src/host/shared.js';
import type { Peer } from '../src/types/rpc.js';
import { clearFolder } from '../../../tools/holders.ts';

/*
 * A shared resource of kind `text`, `x-ahpd-shared:<file URI>`, against a real folder.
 *
 * Two clients open one file. What each one sees is the `action` notes its
 * peer collected; the file on disk is read back to see what the host wrote.
 */

let root: string;
let file: string;
let channel: string;

interface Note { method: string; params: unknown }
type Envelope = { channel: string; action: Record<string, unknown>; origin?: { clientId: string; clientSeq: number }; rejectionReason?: string };

function peer(): Peer & { notes: Note[] } {
  const notes: Note[] = [];
  return { notes, send: () => {}, notify: (method, params) => notes.push({ method, params }), request: async () => ({}), answered: () => {}, close: () => {} };
}

const until = async (what: () => boolean, why: string, ms = WAIT_MS): Promise<void> => {
  const stop = Date.now() + ms;
  while (Date.now() < stop) {
    if (what()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  throw new Error(`Timed out waiting for ${why}`);
};

/** The document actions one peer has been sent, in order. */
const seen = (p: ReturnType<typeof peer>): Envelope[] => p.notes
  .filter((n) => n.method === 'action')
  .map((n) => n.params as Envelope)
  .filter((n) => n.channel === channel);

function makeHost(resources = fileResources()) {
  return createHost({ path: root, agents: [echo({ path: root, pace: 0 })], resources });
}

/** The file store, counting each write once the host's call to it has resolved. */
function countedResources(): { resources: ReturnType<typeof fileResources>; written: () => number } {
  const resources = fileResources();
  const write = resources.write!.bind(resources);
  let written = 0;
  resources.write = async (...args) => { await write(...args); written += 1; };
  return { resources, written: () => written };
}

async function join_(host: ReturnType<typeof makeHost>, clientId: string) {
  const p = peer();
  const client = host.accept(p);
  await client.handle({ method: 'initialize', params: { clientId, protocolVersions: ['0.9.0'], initialSubscriptions: ['ahp-root://'] } });
  const opened = await client.handle({ method: 'subscribe', params: { channel } }) as {
    snapshot: { fromSeq: number; state: { text: string; version: number; saved: number; people: { client: string; name: string; kind?: string; editing?: boolean }[] } };
  };
  let seq = 0;
  const send = (action: Record<string, unknown>): number => {
    seq += 1;
    void client.handle({ method: 'dispatchAction', params: { channel, clientSeq: seq, action } });
    return seq;
  };
  return { client, peer: p, opened, send };
}

const changed = (version: number, changes: unknown, ranges: unknown = []) => ({ type: 'x-ahpd-shared/changed', version, changes, ranges });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ahpd-doc-'));
  file = join(root, 'PLAN.md');
  writeFileSync(file, '## Tasks\n- one\n');
  channel = `x-ahpd-shared:file://${file}`;
});
afterEach(() => { clearFolder(root); });

it('hands a subscriber the text, version 0 and the people, and tells the others who joined and left', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  expect(ana.opened.snapshot.state).toMatchObject({ kind: 'text', text: '## Tasks\n- one\n', version: 0, saved: 0 });
  // A host with no users directory: each person is a guest, named by the start of the client id.
  expect(ana.opened.snapshot.state.people[0]).toMatchObject({ client: 'ana', name: 'ana guest', kind: 'guest', editing: false });
  expect(ana.opened.snapshot.state.people.map((one) => one.client)).toEqual(['ana']);

  const rafael = await join_(host, 'rafael');
  expect(rafael.opened.snapshot.state.people.map((one) => one.client)).toEqual(['ana', 'rafael']);
  await until(() => seen(ana.peer).some((one) => one.action.type === 'x-ahpd-shared/joined' && one.action.client === 'rafael'), 'joined');
  // The one who joined is not told of itself: its snapshot holds it.
  expect(seen(rafael.peer).some((one) => one.action.type === 'x-ahpd-shared/joined')).toBe(false);

  void rafael.client.handle({ method: 'unsubscribe', params: { channel } });
  await until(() => seen(ana.peer).some((one) => one.action.type === 'x-ahpd-shared/left' && one.action.client === 'rafael'), 'left');
  await host.close();
});

it('takes a change at the current version, and sends it to everyone with the sender as its origin', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  const seq = ana.send({ ...changed(0, [{ from: 14, to: 14, insert: '- two\n' }], [{ anchor: 20, head: 20 }]), id: 'tab-1' });
  for (const who of [ana, rafael]) {
    await until(() => seen(who.peer).some((one) => one.action.type === 'x-ahpd-shared/changed'), 'the change');
    const got = seen(who.peer).find((one) => one.action.type === 'x-ahpd-shared/changed')!;
    expect(got.origin).toEqual({ clientId: 'ana', clientSeq: seq });
    expect(got.action).toMatchObject({ version: 0, changes: [{ from: 14, to: 14, insert: '- two\n' }], ranges: [{ anchor: 20, head: 20 }], id: 'tab-1' });
  }
  await host.close();
});

it('moves a change made on an older version past the one taken first, so both land', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  // Both on version 0: Ana inserts at the start, Rafael at the end.
  ana.send(changed(0, [{ from: 0, to: 0, insert: '# Plan\n' }]));
  rafael.send(changed(0, [{ from: 15, to: 15, insert: '- two\n' }]));
  await until(() => seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/changed').length === 2, 'both changes');
  const [first, second] = seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/changed');
  expect(first!.action).toMatchObject({ version: 0, changes: [{ from: 0, to: 0, insert: '# Plan\n' }] });
  // Rafael's, moved past Ana's seven characters, applies to version 1.
  expect(second!.action).toMatchObject({ version: 1, changes: [{ from: 22, to: 22, insert: '- two\n' }] });
  expect(second!.rejectionReason).toBeUndefined();

  // A third client sees the text both made.
  const third = await join_(host, 'third');
  expect(third.opened.snapshot.state).toMatchObject({ text: '# Plan\n## Tasks\n- one\n- two\n', version: 2 });
  await host.close();
});

it('puts two inserts at one place in the order the host took them', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  ana.send(changed(0, [{ from: 0, to: 0, insert: 'A' }]));
  rafael.send(changed(0, [{ from: 0, to: 0, insert: 'B' }]));
  await until(() => seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/changed').length === 2, 'both changes');
  const third = await join_(host, 'third');
  expect(third.opened.snapshot.state.text.startsWith('AB## Tasks')).toBe(true);
  await host.close();
});

it('refuses a change older than its log, and the text stays as it was', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  for (let i = 0; i < SHARED_LOG + 1; i += 1) ana.send(changed(i, [{ from: 0, to: 0, insert: 'x' }]));
  await until(() => seen(rafael.peer).filter((one) => one.action.type === 'x-ahpd-shared/changed').length === SHARED_LOG + 1, 'every change');
  rafael.send(changed(0, [{ from: 0, to: 0, insert: 'late' }]));
  await until(() => seen(rafael.peer).some((one) => one.rejectionReason !== undefined), 'the refusal');
  expect(seen(rafael.peer).find((one) => one.rejectionReason !== undefined)!.rejectionReason).toMatch(/^stale:/);
  const third = await join_(host, 'third');
  expect(third.opened.snapshot.state.text).not.toContain('late');
  await host.close();
});

it('moves carets with a change and brings a caret on an older version up to the current one', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  rafael.send({ type: 'x-ahpd-shared/selected', version: 0, ranges: [{ anchor: 10, head: 12 }, { anchor: 3, head: 3 }] });
  await until(() => seen(ana.peer).some((one) => one.action.type === 'x-ahpd-shared/selected'), 'the carets');
  ana.send(changed(0, [{ from: 0, to: 0, insert: '>>' }]));
  await until(() => seen(rafael.peer).some((one) => one.action.type === 'x-ahpd-shared/changed'), 'the change');
  // A caret on version 0, sent after the change, arrives on version 1.
  rafael.send({ type: 'x-ahpd-shared/selected', version: 0, ranges: [{ anchor: 5, head: 5 }] });
  await until(() => seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/selected').length === 2, 'the second carets');
  const late = seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/selected')[1]!;
  expect(late.action).toMatchObject({ version: 1, ranges: [{ anchor: 7, head: 7 }] });
  const third = await join_(host, 'third');
  expect(third.opened.snapshot.state.people.find((one) => one.client === 'rafael')).toMatchObject({ ranges: [{ anchor: 7, head: 7 }] });
  await host.close();
});

it('writes the text to the file after the last change, and says which version is saved', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  ana.send(changed(0, [{ from: 15, to: 15, insert: '- two\n' }]));
  await until(() => readFileSync(file, 'utf8') === '## Tasks\n- one\n- two\n', 'the write', WAIT_MS + 3_000);
  await until(() => seen(ana.peer).some((one) => one.action.type === 'x-ahpd-shared/saved' && one.action.version === 1), 'saved');
  // The host's own write comes back through the watch as no change.
  await new Promise((r) => { setTimeout(r, 500); });
  expect(seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/changed')).toHaveLength(1);
  await host.close();
});

it('takes a write from outside as one change, and keeps an edit it has not written yet', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  // Ana's edit is held, not yet on disk.
  ana.send(changed(0, [{ from: 0, to: 0, insert: '# Plan\n' }]));
  await until(() => seen(ana.peer).some((one) => one.action.type === 'x-ahpd-shared/changed'), 'her change');
  // An agent's tool writes the file it read, which does not have her edit.
  writeFileSync(file, '## Tasks\n- one\n- from the agent\n');
  await until(() => seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/changed').length === 2, 'the outside write');
  const outside = seen(ana.peer).filter((one) => one.action.type === 'x-ahpd-shared/changed')[1]!;
  expect(outside.origin).toBeUndefined();
  expect(outside.action).toMatchObject({ version: 1, changes: [{ from: 22, to: 22, insert: '- from the agent\n' }] });
  // Both are in the file once the host writes it.
  await until(() => readFileSync(file, 'utf8') === '# Plan\n## Tasks\n- one\n- from the agent\n', 'both on disk', WAIT_MS + 3_000);
  await host.close();
});

it('writes the text and lets the document go when the last person leaves', async () => {
  const counted = countedResources();
  const host = makeHost(counted.resources);
  const ana = await join_(host, 'ana');
  ana.send(changed(0, [{ from: 0, to: 0, insert: '# Plan\n' }]));
  await until(() => seen(ana.peer).some((one) => one.action.type === 'x-ahpd-shared/changed'), 'her change');
  void ana.client.handle({ method: 'unsubscribe', params: { channel } });
  // The host lets the document go once its write resolves, and the file can
  // hold the text before that, so the case waits for the write itself.
  await until(() => counted.written() === 1, 'the write on leaving');
  expect(readFileSync(file, 'utf8')).toBe('# Plan\n## Tasks\n- one\n');
  // A later subscriber reads the file afresh, at version 0.
  const again = await join_(host, 'again');
  expect(again.opened.snapshot.state).toMatchObject({ text: '# Plan\n## Tasks\n- one\n', version: 0 });
  await host.close();
});

it('refuses a file that is not text, and a scheme that is not file:', async () => {
  const host = makeHost();
  const binary = join(root, 'blob.bin');
  writeFileSync(binary, Buffer.from([0, 159, 146, 150, 0, 1, 2]));
  const p = peer();
  const client = host.accept(p);
  await client.handle({ method: 'initialize', params: { clientId: 'x', protocolVersions: ['0.9.0'], initialSubscriptions: ['ahp-root://'] } });
  await expect(client.handle({ method: 'subscribe', params: { channel: `x-ahpd-shared:file://${binary}` } })).rejects.toThrow(/not text/);
  await expect(client.handle({ method: 'subscribe', params: { channel: 'x-ahpd-shared:bot://x' } })).rejects.toThrow(/Only a file: URI/);
  await host.close();
});

it('keeps document actions out of a reconnect, and names the channel missing so the client subscribes again', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  const upTo = rafael.opened.snapshot.fromSeq;
  ana.send(changed(0, [{ from: 0, to: 0, insert: '# Plan\n' }]));
  await until(() => seen(rafael.peer).some((one) => one.action.type === 'x-ahpd-shared/changed'), 'the change');
  const back = host.accept(peer());
  await back.handle({ method: 'initialize', params: { clientId: 'rafael', protocolVersions: ['0.9.0'] } });
  const result = await back.handle({
    method: 'reconnect',
    params: { channel: 'ahp-root://', clientId: 'rafael', lastSeenServerSeq: upTo, subscriptions: ['ahp-root://', channel] },
  }) as { type: string; actions?: Envelope[]; missing?: string[] };
  expect(result.type).toBe('replay');
  expect((result.actions ?? []).some((one) => one.channel === channel)).toBe(false);
  expect(result.missing).toContain(channel);
  await host.close();
});

it('tells everyone who is editing, not only reading', async () => {
  const host = makeHost();
  const ana = await join_(host, 'ana');
  const rafael = await join_(host, 'rafael');
  const seq = ana.send({ type: 'x-ahpd-shared/editing', editing: true });
  await until(() => seen(rafael.peer).some((one) => one.action.type === 'x-ahpd-shared/editing'), 'editing');
  const got = seen(rafael.peer).find((one) => one.action.type === 'x-ahpd-shared/editing')!;
  expect(got.origin).toEqual({ clientId: 'ana', clientSeq: seq });
  expect(got.action).toMatchObject({ editing: true });
  const third = await join_(host, 'third');
  expect(third.opened.snapshot.state.people.find((one) => one.client === 'ana')).toMatchObject({ editing: true });
  await host.close();
});

it('names the host own root connection root and the start of its client id', async () => {
  const host = makeHost();
  const p = peer();
  const client = host.accept(p, undefined, true);
  await client.handle({ method: 'initialize', params: { clientId: 'f3eb9c', protocolVersions: ['0.9.0'], initialSubscriptions: ['ahp-root://'] } });
  const opened = await client.handle({ method: 'subscribe', params: { channel } }) as { snapshot: { state: { people: { name: string; kind: string }[] } } };
  expect(opened.snapshot.state.people).toEqual([expect.objectContaining({ name: 'root f3eb', kind: 'root' })]);
  await host.close();
});
