import { spawn } from 'node:child_process';
import type { Asked, SpawnedProcess } from '../spawn.js';

/*
 * The CLI as this host spawns it, so that a start can wait for the exit of the
 * CLI before it.
 *
 * The SDK's close waits at most 2 s for its CLI and kills it 5 s after it was
 * told to stop, and it says nothing when the process has gone. Through its
 * `spawnClaudeCodeProcess` hook the process is this host's, and its `exit` is
 * what one CLI at a time waits on (`Clis`). A CLI on this host is spawned as
 * the SDK spawns its own; a CLI in a machine through the session's own hook.
 * npm://@anthropic-ai/claude-agent-sdk@0.3.325 (sdk.mjs, `spawnLocalProcess`)
 */

/** What the SDK hands its spawn hook: `Asked`, with the folder and the abort signal it also gives. */
export interface SpawnAsked extends Asked {
  cwd?: string;
  signal?: AbortSignal;
}

/** One CLI this host spawned: when it has exited, and the end of what it wrote to stderr. */
export interface OwnCli {
  exited: Promise<void>;
  stderrTail(): string;
}

/** How much of a CLI's stderr is kept, as much as the SDK keeps of its own. */
const TAIL = 4_096;

/** When a spawned process has exited, or failed to start. */
const exitOf = (child: SpawnedProcess): Promise<void> => new Promise<void>((done) => {
  if (child.exitCode !== null) {
    done();
    return;
  }
  child.once('exit', () => { done(); });
  child.once('error', () => { done(); });
});

/**
 * A spawn hook for the SDK, which tells `spawned` of each CLI it starts.
 *
 * `inside` is the session's own hook, for a CLI in a machine. Without it the
 * CLI is spawned here as the SDK spawns it: piped, with the abort signal the
 * SDK fires after its grace, and no console window on Windows. Its stderr is
 * read, as the SDK reads it, so a full pipe never blocks it, and its end is
 * kept for the failure a CLI that exits badly is reported with.
 */
export const ownSpawn = (inside: ((asked: SpawnAsked) => SpawnedProcess) | undefined, spawned: (cli: OwnCli) => void) =>
  (asked: SpawnAsked): SpawnedProcess => {
    if (inside !== undefined) {
      const child = inside(asked);
      spawned({ exited: exitOf(child), stderrTail: () => '' });
      return child;
    }
    const child = spawn(asked.command, asked.args, {
      ...(asked.cwd === undefined ? {} : { cwd: asked.cwd }),
      env: asked.env,
      ...(asked.signal === undefined ? {} : { signal: asked.signal }),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let tail = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { tail = (tail + chunk).slice(-TAIL); });
    child.stderr.on('error', () => { /* A pipe that broke as the CLI went. */ });
    // A process that could not start is the SDK's to report, from the same event.
    child.on('error', () => {});
    spawned({ exited: exitOf(child as unknown as SpawnedProcess), stderrTail: () => tail.trim() });
    return child as unknown as SpawnedProcess;
  };

/**
 * A failure in the SDK's words, with the end of the CLI's stderr, as the SDK
 * adds it to a CLI it spawned itself.
 */
export const withStderr = (why: string, cli: OwnCli | undefined): string => {
  const tail = cli?.stderrTail() ?? '';
  return tail === '' || why.includes('stderr:') || !/^Claude Code process (exited|terminated)/.test(why) ? why : `${why}. stderr: ${tail}`;
};
