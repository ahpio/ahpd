import type { OwnCli } from './ownspawn.js';

/**
 * The CLIs the sessions of one agent run, by each conversation id one of them
 * writes, from its start until it has exited.
 *
 * A conversation has one CLI at a time: two that run on it each answer from
 * their own context, write their own branch of its transcript, and keep their
 * own running cost. So a start closes every CLI still on the conversation it
 * writes, in any session of the agent, and waits for each to exit first: the
 * wait VS Code's Claude makes for its live query before it deletes a
 * transcript, made before every start.
 * https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/agentHost/node/claude/claudeAgent.ts#L1148-L1160
 */
export type Clis = Map<string, Set<object>>;

/** The process each CLI runs as, where this host spawned it (`ownSpawn`). */
const processes = new WeakMap<object, OwnCli>();

/** Keep the process a CLI runs as, so its close waits for its exit. */
export const ownedBy = (one: object, cli: OwnCli | undefined): void => {
  if (cli !== undefined) processes.set(one, cli);
};

/** The process a CLI runs as, where this host spawned it. */
export const processOf = (one: object): OwnCli | undefined => processes.get(one);

/** The CLIs this host closed, whose stream ends as this host's own doing and not as a CLI that died. */
const closed = new WeakSet<object>();

/** Whether this host closed the CLI. */
export const isClosed = (one: object): boolean => closed.has(one);

/**
 * Close a CLI without waiting for it, for a caller that says why a close that
 * throws failed.
 */
export const closeCli = (one: object): void => {
  closed.add(one);
  (one as { close?: () => void }).close?.();
};

/**
 * Close a CLI and wait for it to exit.
 *
 * The SDK's dispose starts the query's cleanup once, however often it is
 * asked, and settles when the CLI's process has exited or after the SDK's own
 * bound of 2 s; a CLI still running then is killed 5 s after it was told to
 * stop. So the wait goes on to the exit of the process, where this host
 * spawned it.
 * npm://@anthropic-ai/claude-agent-sdk@0.3.325 (sdk.mjs, `Query.cleanup` and the transport's `close`)
 */
export const stopCli = async (one: object): Promise<void> => {
  closed.add(one);
  try { await (one as { [Symbol.asyncDispose]?: () => Promise<void> })[Symbol.asyncDispose]?.(); }
  catch { /* A CLI already gone is stopped all the same. */ }
  await processes.get(one)?.exited;
};

/** Keep a CLI under each conversation id it writes. */
export const keepCli = (clis: Clis | undefined, ids: Iterable<string | undefined>, one: object): void => {
  if (clis === undefined) return;
  for (const id of ids) {
    if (id === undefined) continue;
    const held = clis.get(id) ?? new Set<object>();
    held.add(one);
    clis.set(id, held);
  }
};

/** Forget a CLI that has exited, under every id it was kept by. */
export const forgetCli = (clis: Clis | undefined, one: object): void => {
  if (clis === undefined) return;
  for (const [id, held] of clis) {
    held.delete(one);
    if (held.size === 0) clis.delete(id);
  }
};

/** Every CLI kept under the ids given, and `also`, once each. */
export const clisOn = (clis: Clis | undefined, ids: Iterable<string | undefined>, also?: object): object[] => {
  const running = new Set<object>(also === undefined ? [] : [also]);
  for (const id of ids) {
    if (id === undefined) continue;
    for (const one of clis?.get(id) ?? []) running.add(one);
  }
  return [...running];
};

/** Close each CLI given, and wait until each has exited. */
export const stopClis = async (clis: Clis | undefined, running: readonly object[]): Promise<void> => {
  await Promise.all(running.map(async (one) => {
    await stopCli(one);
    forgetCli(clis, one);
  }));
};
