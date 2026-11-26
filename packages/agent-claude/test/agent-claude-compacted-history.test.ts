import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import type { Bag } from '@ahpd/sdk';
import { clearFolder } from '../../../tools/holders.ts';

/*
 * A compacted Claude session, read back by the real SDK.
 *
 * `getSessionMessages` starts at a session's last compaction, and the turns
 * before it are read through its `sessionStore` option, which the SDK marks
 * `@alpha`. This case reads a transcript written as the CLI writes one, with
 * no mock, so an SDK version that reads a store another way fails here.
 */

const CONFIG = mkdtempSync(join(tmpdir(), 'ahpd-compacted-'));
const configBefore = process.env.CLAUDE_CONFIG_DIR;
process.env.CLAUDE_CONFIG_DIR = CONFIG;
afterAll(() => {
  if (configBefore === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = configBefore;
  clearFolder(CONFIG);
});

const { turnsOf } = await import('../src/transcript.js');

const SESSION = '0d6f3c1e-9a52-4b7e-8c11-5f2a7d4e9b30';
const CWD = '/work/project';

let clock = Date.parse('2026-01-01T00:00:00.000Z');
let last: string | null = null;
let count = 0;

/** One transcript entry as the CLI writes it, chained to the entry before it unless `extra` says otherwise. */
function entry(type: string, extra: Bag): Bag {
  count += 1;
  const uuid = `00000000-0000-4000-8000-${String(count).padStart(12, '0')}`;
  clock += 1000;
  const written: Bag = {
    parentUuid: last, isSidechain: false, userType: 'external', cwd: CWD, sessionId: SESSION, version: '2.1.0',
    type, uuid, timestamp: new Date(clock).toISOString(), ...extra,
  };
  last = uuid;
  return written;
}

const prompt = (text: string): Bag => entry('user', { message: { role: 'user', content: text } });

const reply = (text: string): Bag => entry('assistant', {
  message: { id: `msg_${count + 1}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 1 } },
});

/** A compaction: no `parentUuid`, the entry before it as its `logicalParentUuid`, then the summary the model goes on from. */
function compaction(): Bag[] {
  const before = last;
  const mark = entry('system', {
    parentUuid: null, logicalParentUuid: before, subtype: 'compact_boundary', content: 'Conversation compacted', level: 'info',
    compactMetadata: { trigger: 'manual', preTokens: 1000 },
  });
  const summary = entry('user', {
    message: { role: 'user', content: 'This session is being continued from a previous conversation that ran out of context.' },
    isCompactSummary: true, isVisibleInTranscriptOnly: true,
  });
  return [mark, summary];
}

it('reads every turn of a session that compacted twice, with a notice where each compaction was', async () => {
  const entries = [
    prompt('one'), reply('One.'),
    ...compaction(),
    prompt('two'), reply('Two.'),
    ...compaction(),
    prompt('three'), reply('Three.'),
  ];
  const project = join(CONFIG, 'projects', CWD.replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, `${SESSION}.jsonl`), entries.map((one) => `${JSON.stringify(one)}\n`).join(''));

  const turns = await turnsOf(SESSION) as unknown as Bag[];

  expect(turns.map((turn) => (turn.message as Bag | undefined)?.text)).toEqual(['one', 'two', 'three']);
  const notices = turns.map((turn) => (turn.responseParts as Bag[]).filter((part) => part.kind === 'systemNotification').map((part) => part.content));
  expect(notices).toEqual([['Conversation compacted'], ['Conversation compacted'], []]);
});
