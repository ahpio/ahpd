import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Bag } from '@ahpd/sdk';

/*
 * One CLI on a conversation at a time.
 *
 * Two CLIs on one conversation each answer from their own context and write
 * their own branch of its transcript: on 2026-11-21 the CLI a model switch
 * replaced answered a task's notification on a branch no later turn followed.
 * So every start closes the CLI still on the conversation it writes, in any
 * session of the agent, and waits for it to exit before it starts its own.
 * Each case here holds a closed CLI's exit until it lets it go, and checks
 * that no CLI starts on the conversation while another is still running.
 */

/** A conversation every case writes, the id its first CLI is named under. */
const TALK = '0a0a0a0a-2222-4222-8222-000000000001';

const sdk = vi.hoisted(() => {
  interface Fake {
    options: Record<string, unknown>;
    held: Record<string, unknown>[];
    wake: (() => void) | undefined;
    closed: boolean;
    /** Whether its frames ended while its process runs on, as a stream that broke. */
    ended: boolean;
    exited: boolean;
    exiting: Promise<void> | undefined;
  }
  const state = {
    queries: [] as Fake[],
    /** How many CLIs of the same conversation were still running as each one started. */
    alongside: [] as number[],
    /** What a closed CLI's exit waits for. */
    gate: Promise.resolve() as Promise<void>,
    hold(): () => void {
      let open: () => void = () => {};
      state.gate = new Promise<void>((done) => { open = done; });
      return () => { open(); state.gate = Promise.resolve(); };
    },
    reset() {
      state.queries.length = 0;
      state.alongside.length = 0;
      state.gate = Promise.resolve();
    },
    /** Frames from the CLI started `at`, the last by default. */
    push(at: number, ...frames: Record<string, unknown>[]) {
      const fake = state.queries.at(at);
      if (fake === undefined) throw new Error('no CLI was started');
      fake.held.push(...frames);
      fake.wake?.();
      fake.wake = undefined;
    },
    /** End the frames of the CLI started `at`, its process running on. */
    end(at: number) {
      const fake = state.queries.at(at);
      if (fake === undefined) throw new Error('no CLI was started');
      fake.ended = true;
      fake.wake?.();
    },
    conversationOf(options: Record<string, unknown>): unknown {
      return options.forkSession === true ? undefined : (options.resume ?? options.sessionId);
    },
  };
  return state;
});

vi.mock('@anthropic-ai/claude-agent-sdk', async () => (await import('../../sdk/test/support/warmed.js')).warmed({
  createSdkMcpServer: (given: Record<string, unknown>) => ({ type: 'sdk', name: given.name, tools: given.tools }),
  getSessionInfo: async (id: string) => ({ sessionId: id }),
  query: ({ prompt, options }: { prompt: AsyncIterable<unknown>; options: Record<string, unknown> }) => {
    const fake = {
      options, held: [] as Record<string, unknown>[], wake: undefined as (() => void) | undefined,
      closed: false, ended: false, exited: false, exiting: undefined as Promise<void> | undefined,
    };
    const talk = sdk.conversationOf(options);
    sdk.alongside.push(talk === undefined ? 0 : sdk.queries.filter((one) => !one.exited && sdk.conversationOf(one.options) === talk).length);
    sdk.queries.push(fake);
    void (async () => { for await (const _ of prompt) { /* read */ } })();
    // A closed CLI exits once the case lets it.
    const exit = (): Promise<void> => {
      fake.exiting ??= sdk.gate.then(() => { fake.exited = true; });
      return fake.exiting;
    };
    return {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          while (fake.held.length > 0 && !fake.closed) yield fake.held.shift() as Record<string, unknown>;
          if (fake.closed || fake.ended) return;
          await new Promise<void>((resolve) => { fake.wake = resolve; });
        }
      },
      interrupt: async () => {},
      setPermissionMode: async () => {},
      setModel: async () => {},
      applyFlagSettings: async () => {},
      toggleMcpServer: async () => {},
      reconnectMcpServer: async () => {},
      setMcpServers: async () => {},
      initializationResult: async () => ({}),
      mcpServerStatus: async () => [],
      reloadSkills: async () => ({ skills: [] }),
      reloadPlugins: async () => ({ plugins: [] }),
      supportedModels: async () => [],
      streamInput: async () => {},
      close: () => { fake.closed = true; fake.wake?.(); void exit(); },
      [Symbol.asyncDispose]: async () => { fake.closed = true; fake.wake?.(); await exit(); },
    };
  },
}));

const { createSession } = await import('../src/session.js');

const settle = async (times = 30): Promise<void> => {
  for (let i = 0; i < times; i++) await new Promise((r) => { setTimeout(r, 0); });
};

/** A turn the CLI started `at` answered and ended, as its frames come. */
const answered = (id: string) => [
  { type: 'system', subtype: 'init', session_id: TALK },
  { type: 'assistant', parent_tool_use_id: null, uuid: `end-${id}`, session_id: TALK, message: { id: `msg-${id}`, role: 'assistant', model: 'claude-x', content: [{ type: 'text', text: `answer ${id}` }] } },
  { type: 'result', subtype: 'success', is_error: false, session_id: TALK, duration_ms: 5 },
];

/** A session on the conversation, of an agent whose sessions share `clis`. */
const open = (clis: Map<string, Set<object>>, extra: Record<string, unknown> = {}) => {
  const chat: Bag[] = [];
  const session = createSession({
    uri: `ahp-session:/${TALK}`,
    chatUri: `ahp-chat:/${TALK}`,
    cwd: mkdtempSync(join(tmpdir(), 'ahpd-one-cli-')),
    emit: (channel, action) => { if (channel === 'chat') chat.push(action as Bag); },
    clis,
    ...extra,
  });
  return { session, chat };
};

/** Run one turn on the CLI started last, to its answer. */
const turn = async (session: { sendMessage: (id: string, text: string) => unknown }, id: string): Promise<void> => {
  session.sendMessage(id, id);
  await settle();
  sdk.push(-1, ...answered(id));
  await settle();
};

beforeEach(() => { sdk.reset(); });

it('closes a CLI whose frames ended, and starts the next only once it has exited', async () => {
  const { session } = open(new Map());
  await turn(session, 't1');
  const go = sdk.hold();
  sdk.end(0);
  await settle();
  expect(sdk.queries[0]?.closed).toBe(true);

  session.sendMessage('t2', 't2');
  await settle();
  expect(sdk.queries).toHaveLength(1);
  go();
  await settle();
  expect(sdk.queries).toHaveLength(2);
  expect(sdk.queries[1]?.options.resume).toBe(TALK);
  expect(sdk.alongside).toEqual([0, 0]);
});

it('starts the CLI of another agent only once the one it replaces has exited', async () => {
  const { session } = open(new Map());
  await turn(session, 't1');
  const go = sdk.hold();
  session.changeAgent({ uri: 'claude-internal:/agent/Plan' });
  session.sendMessage('t2', 't2');
  await settle();
  expect(sdk.queries[0]?.closed).toBe(true);
  expect(sdk.queries).toHaveLength(1);
  go();
  await settle();
  expect(sdk.queries).toHaveLength(2);
  expect(sdk.queries[1]?.options).toMatchObject({ agent: 'Plan', resume: TALK });
  expect(sdk.alongside).toEqual([0, 0]);
});

it('starts the CLI of an edited record only once the one it replaces has exited', async () => {
  let values: Bag = { effort: 'low' };
  const { session } = open(new Map(), { presetOf: () => values });
  await settle();
  await turn(session, 't1');
  const go = sdk.hold();
  values = { effort: 'high' };
  session.sendMessage('t2', 't2');
  await settle();
  expect(sdk.queries[0]?.closed).toBe(true);
  expect(sdk.queries).toHaveLength(1);
  go();
  await settle();
  expect(sdk.queries).toHaveLength(2);
  expect(sdk.alongside).toEqual([0, 0]);
});

it('closes the CLI of another session on the conversation, and starts only once it has exited', async () => {
  const clis = new Map<string, Set<object>>();
  const first = open(clis);
  await turn(first.session, 't1');
  const go = sdk.hold();
  const second = open(clis, { uri: 'ahp-session:/again', chatUri: 'ahp-chat:/again', resume: TALK });
  second.session.sendMessage('t2', 't2');
  await settle();
  expect(sdk.queries[0]?.closed).toBe(true);
  expect(sdk.queries).toHaveLength(1);
  go();
  await settle();
  expect(sdk.queries).toHaveLength(2);
  expect(sdk.queries[1]?.options.resume).toBe(TALK);
  expect(sdk.alongside).toEqual([0, 0]);
});

it('waits for a closed session\'s CLI that exits late before a session resumes its conversation', async () => {
  const clis = new Map<string, Set<object>>();
  const first = open(clis);
  await turn(first.session, 't1');
  const go = sdk.hold();
  const closed = first.session.close();
  const second = open(clis, { uri: 'ahp-session:/later', chatUri: 'ahp-chat:/later', resume: TALK });
  second.session.sendMessage('t2', 't2');
  await settle();
  expect(sdk.queries).toHaveLength(1);
  go();
  await closed;
  await settle();
  expect(sdk.queries).toHaveLength(2);
  expect(sdk.alongside).toEqual([0, 0]);
});

it('leaves the CLI of the conversation a fork was cut from running', async () => {
  const clis = new Map<string, Set<object>>();
  const first = open(clis);
  await turn(first.session, 't1');
  const fork = open(clis, { uri: 'ahp-session:/fork', chatUri: 'ahp-chat:/fork', resume: TALK, forkAt: 'end-t1' });
  fork.session.sendMessage('t2', 't2');
  await settle();
  expect(sdk.queries).toHaveLength(2);
  expect(sdk.queries[1]?.options).toMatchObject({ resume: TALK, forkSession: true });
  expect(sdk.queries[0]?.closed).toBe(false);
});

it('forgets a CLI once it has exited', async () => {
  const clis = new Map<string, Set<object>>();
  const { session } = open(clis);
  await turn(session, 't1');
  expect(clis.get(TALK)?.size).toBe(1);
  await session.close();
  await settle();
  expect(clis.size).toBe(0);
});

it('reads no frame of a CLI it replaced', async () => {
  const { session, chat } = open(new Map());
  await turn(session, 't1');
  session.changeAgent({ uri: 'claude-internal:/agent/Plan' });
  session.sendMessage('t2', 't2');
  await settle();
  expect(sdk.queries).toHaveLength(2);
  // Frames the CLI that was replaced still had to give, which answer nothing.
  sdk.queries[0]?.held.push(...answered('late'));
  sdk.queries[0]?.wake?.();
  await settle();
  expect(chat.some((action) => JSON.stringify(action).includes('answer late'))).toBe(false);
});
