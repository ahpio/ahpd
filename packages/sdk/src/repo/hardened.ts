/**
 * The argv every `git` this host runs is given.
 *
 * A repository's own files can make git run a program: an fsmonitor its config
 * names, and a submodule's config reached by recursing into a gitlink and a
 * `.git` an agent wrote inside a worktree. So each run turns off the fsmonitor
 * and submodule recursion with `-c`, and a subcommand that would look into
 * submodules is told `--ignore-submodules`.
 */

import { execFile } from 'node:child_process';
import type { ChildProcess, ExecFileException, ExecFileOptions } from 'node:child_process';

/** The `-c` pairs before every subcommand. */
export const GIT_HARDENED = ['-c', 'core.fsmonitor=', '-c', 'submodule.recurse=false'] as const;

/** The subcommands that take `--ignore-submodules`. */
const IGNORES_SUBMODULES = new Set(['status', 'diff', 'diff-index', 'diff-files']);

/**
 * `git -c ... -C <dir> <args>`, with `--ignore-submodules` right after a
 * subcommand that takes it. A caller's own `-c` pairs before the subcommand
 * are kept where they are.
 */
export const gitArgv = (dir: string, args: readonly string[]): string[] => {
  let at = 0;
  while (at < args.length && args[at] === '-c') at += 2;
  const subcommand = args[at];
  const own = subcommand !== undefined && IGNORES_SUBMODULES.has(subcommand)
    ? [...args.slice(0, at + 1), '--ignore-submodules', ...args.slice(at + 1)]
    : [...args];
  // `git -C ''` runs in the current folder: a folder lost on the way here would
  // run git in whatever repository this process was started in.
  if (dir === '') throw new Error(`git ${own.join(' ')} was given no folder to run in`);
  return [...GIT_HARDENED, '-C', dir, ...own];
};

/** Every `git` this process started through `runGit` that has not closed yet. */
const running = new Set<Promise<void>>();

/** How long a `git` runs before it is said to be slow, in milliseconds. */
export const SLOW_GIT_MS = 2000;

/** Who hears of a slow `git`: the host's log at debug level, once a host has said so. */
let slowGitListener: ((line: string) => void) | undefined;

/**
 * Hear of every `git` that runs longer than `SLOW_GIT_MS`, as one line naming
 * the folder, the arguments and the time. One listener for the process,
 * because `runGit` is one for the process; `undefined` stops hearing.
 *
 * A git call that stalls on a Windows runner leaves a case that times out with
 * nothing to say which call it was, and this is what says it.
 */
export const onSlowGit = (listener: ((line: string) => void) | undefined): void => {
  slowGitListener = listener;
};

/**
 * The line for a slow `git`, said to the listener when it ran longer than
 * `SLOW_GIT_MS`, and written to stderr when it ran longer than
 * `AHPD_GIT_SLOW_MS`, which a CI job sets so a failing run's log names it.
 * `runGit` times every call of the host with it, and `tools/git.ts` every
 * call a test makes itself.
 */
export const timed = (dir: string, args: readonly string[], ms: number): void => {
  const line = `slow git: ${String(ms)} ms for git ${args.join(' ')} in ${dir}`;
  if (ms > SLOW_GIT_MS) slowGitListener?.(line);
  const limit = Number(process.env['AHPD_GIT_SLOW_MS']);
  if (Number.isFinite(limit) && limit > 0 && ms > limit) process.stderr.write(`${line}\n`);
};

/**
 * `git` with `gitArgv`'s argv, run in `dir` and kept among the ones running
 * until it closes.
 *
 * Windows will not remove a folder that a process is working in, and each of
 * these runs in a session's folder: a host that closed while one ran left that
 * folder busy behind it. `gitSettled` is what a close waits on.
 */
export const runGit = (
  dir: string,
  args: readonly string[],
  options: ExecFileOptions,
  done: (error: ExecFileException | null, out: string, err: string) => void,
): ChildProcess => {
  const started = Date.now();
  const child = execFile('git', gitArgv(dir, args), { ...options, encoding: 'utf8' }, (error, out, err) => done(error, out, err));
  const closed = new Promise<void>((resolve) => {
    child.once('close', () => resolve());
    child.once('error', () => resolve());
  });
  void closed.then(() => { timed(dir, args, Date.now() - started); });
  running.add(closed);
  void closed.then(() => running.delete(closed));
  return child;
};

/** Settles once every `git` that `runGit` had started by now has closed. */
export const gitSettled = (): Promise<void> => Promise.all([...running]).then(() => undefined);
