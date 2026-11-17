import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { timed } from '../packages/sdk/src/repo/hardened.js';
import { WAIT_MS } from './wait.ts';

/*
 * A test's own `git`, run and waited for.
 *
 * A synchronous call blocks the event loop, so a `git` that stalls in a case's
 * setup holds back vitest's own timer too: the case then fails as a timeout of
 * the whole case, seconds late, with nothing to say which call it was. This
 * gives each call a timeout under the case's budget, so a stall fails at the
 * call and names it, and times it as `runGit` times the host's calls.
 */

/**
 * `git <args>`, with `options` over the defaults, and its output as a string.
 *
 * The timeout is `WAIT_MS` unless `options` gives one. A call that outlives it
 * throws an error naming the call; any other failure is `execFileSync`'s own,
 * with git's stderr on it.
 */
export const gitSync = (args: readonly string[], options: ExecFileSyncOptions = {}): string => {
  const timeout = options.timeout ?? WAIT_MS;
  const started = Date.now();
  try {
    return execFileSync('git', args, { stdio: 'pipe', windowsHide: true, ...options, timeout, encoding: 'utf8' });
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      throw new Error(`git ${args.join(' ')} did not finish in ${String(timeout)} ms`, { cause: error });
    }
    throw error;
  }
  finally {
    timed(typeof options.cwd === 'string' ? options.cwd : '-', args, Date.now() - started);
  }
};
