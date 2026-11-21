import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { gitSync } from '../../../tools/git.ts';

/*
 * A test's own `git`: answered as a string, timed like the host's calls, and
 * stopped at its timeout with the call named.
 */

const before = process.env['AHPD_GIT_SLOW_MS'];

afterEach(() => {
  vi.restoreAllMocks();
  if (before === undefined) delete process.env['AHPD_GIT_SLOW_MS'];
  else process.env['AHPD_GIT_SLOW_MS'] = before;
});

it('answers a call as a string', () => {
  expect(gitSync(['--version'])).toMatch(/^git version /);
});

it('says a call over AHPD_GIT_SLOW_MS on stderr, with its arguments', () => {
  process.env['AHPD_GIT_SLOW_MS'] = '1';
  const said: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation((line) => { said.push(String(line)); return true; });
  /*
   * The call is timed by the clock, not left to how fast this machine is: a
   * `git --version` on a fast runner takes a millisecond or less, which is
   * not over the limit, so the call is made to start at 0 and end at 50.
   */
  vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(50);
  gitSync(['--version']);
  const slow = said.filter((line) => line.startsWith('slow git: '));
  expect(slow).toHaveLength(1);
  expect(slow[0]).toContain('for git --version in -');
});

it('stops a call at its timeout, and names the call', () => {
  // No git starts and answers within a millisecond.
  expect(() => gitSync(['--version'], { timeout: 1 })).toThrow('git --version did not finish in 1 ms');
});

/** A synchronous `git` a test starts itself, with no timeout and no timing. */
const DIRECT = /\b(?:execFileSync|spawnSync)\(\s*['"`]git['"`]/;

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

it('finds no test that runs git without gitSync', () => {
  // The pattern is what a test would write, so it is checked on one first,
  // put together here so this file does not match it.
  const call = (name: string, between: string): string => `${name}(${between}'git', ['status'])`;
  expect(DIRECT.test(call('execFileSync', ''))).toBe(true);
  expect(DIRECT.test(call('spawnSync', '\n  '))).toBe(true);
  const direct = readdirSync(join(ROOT, 'packages'))
    .flatMap((pkg) => {
      const tests = join(ROOT, 'packages', pkg, 'test');
      let names: string[];
      try { names = readdirSync(tests, { recursive: true, encoding: 'utf8' }); }
      catch { return []; }
      return names.filter((name) => name.endsWith('.ts')).map((name) => join('packages', pkg, 'test', name));
    })
    .filter((file) => DIRECT.test(readFileSync(join(ROOT, file), 'utf8')));
  expect(direct).toEqual([]);
});
