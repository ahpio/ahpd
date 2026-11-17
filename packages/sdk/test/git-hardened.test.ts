import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { posix } from '../../../tools/posix.ts';
import { gitChanges } from '../src/sessions/changes.js';
import { gitBranches } from '../src/repo/git.js';
import { SLOW_GIT_MS, gitArgv, onSlowGit, runGit } from '../src/repo/hardened.js';
import { gitWorktrees } from '../src/repo/worktrees.js';

/*
 * Every git this host runs turns off what a repository's own files could make
 * it run: the fsmonitor a config names, and a recursion into submodules whose
 * config an agent may have written inside a worktree.
 */

let root: string;
let log: string;
const before = { path: process.env.PATH, log: process.env.AHPD_FAKE_GIT_LOG };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ahpd-hardened-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  log = join(root, 'calls');
  // A `git` that records each argv on one line and answers nothing.
  writeFileSync(join(bin, 'git'), '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$AHPD_FAKE_GIT_LOG"\nexit 0\n');
  chmodSync(join(bin, 'git'), 0o755);
  process.env.PATH = `${bin}:${before.path ?? ''}`;
  process.env.AHPD_FAKE_GIT_LOG = log;
});

afterEach(() => {
  process.env.PATH = before.path;
  if (before.log === undefined) delete process.env.AHPD_FAKE_GIT_LOG;
  else process.env.AHPD_FAKE_GIT_LOG = before.log;
  rmSync(root, { recursive: true, force: true });
});

const calls = (): string[] => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter((one) => one !== '') : []);
const HARDENED = '-c core.fsmonitor= -c submodule.recurse=false';

it('spells the flags before the folder, and --ignore-submodules after a subcommand that takes it', () => {
  expect(gitArgv('/r', ['status', '--porcelain'])).toEqual([
    '-c', 'core.fsmonitor=', '-c', 'submodule.recurse=false', '-C', '/r', 'status', '--ignore-submodules', '--porcelain',
  ]);
  expect(gitArgv('/r', ['-c', 'core.excludesFile=/x', 'diff', '--cached'])).toEqual([
    '-c', 'core.fsmonitor=', '-c', 'submodule.recurse=false', '-C', '/r', '-c', 'core.excludesFile=/x', 'diff', '--ignore-submodules', '--cached',
  ]);
  expect(gitArgv('/r', ['rev-parse', 'HEAD'])).toEqual([
    '-c', 'core.fsmonitor=', '-c', 'submodule.recurse=false', '-C', '/r', 'rev-parse', 'HEAD',
  ]);
});

it('refuses no folder, which git would read as the folder this process runs in', () => {
  expect(() => gitArgv('', ['worktree', 'add', '-b', 'agents/x', '/w'])).toThrow('was given no folder to run in');
});

// The next three run a `git` that is a `#!/bin/sh` script first on `PATH`: a
// POSIX shell outside a terminal, which Windows has not.
it.skipIf(!posix)('runs the worktree port\'s git hardened', async () => {
  await gitWorktrees().dirty(root);
  expect(calls()).toEqual([`${HARDENED} -C ${root} status --ignore-submodules --porcelain`]);
});

it.skipIf(!posix)('runs the changes source\'s git hardened', async () => {
  await gitChanges().refresh?.(root);
  const said = calls();
  expect(said.length).toBeGreaterThan(0);
  expect(said.every((one) => one.startsWith(`${HARDENED} -C ${root} `))).toBe(true);
  expect(said.find((one) => one.includes(' status '))).toContain('status --ignore-submodules');
});

it.skipIf(!posix)('runs the branch facts\' git hardened', async () => {
  await gitBranches().refresh?.(root);
  const said = calls();
  expect(said.length).toBeGreaterThan(0);
  expect(said.every((one) => one.startsWith(`${HARDENED} -C ${root} `))).toBe(true);
});

/*
 * A git call slower than `SLOW_GIT_MS` says so, with its arguments and time, so
 * a case that stalls on a slow runner names the call. The clock is stood in for,
 * so a fast `git --version` reads as slow or fast as the case needs.
 */
const versionOf = (): Promise<void> => new Promise((resolve) => {
  runGit(root, ['--version'], { windowsHide: true }, () => { resolve(); });
});

/** Let the call's close, and the timing behind it, come to. */
const closedNow = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 50); });

/**
 * Run with `AHPD_GIT_SLOW_MS` as a case needs it, and put back after. A Windows
 * CI job sets it, and a stood-in slow call would otherwise reach that job's
 * log as a `slow git:` line no git call made.
 */
const withSlowLimit = async (limit: string | undefined, run: () => Promise<void>): Promise<void> => {
  const before = process.env['AHPD_GIT_SLOW_MS'];
  if (limit === undefined) delete process.env['AHPD_GIT_SLOW_MS'];
  else process.env['AHPD_GIT_SLOW_MS'] = limit;
  try { await run(); }
  finally {
    if (before === undefined) delete process.env['AHPD_GIT_SLOW_MS'];
    else process.env['AHPD_GIT_SLOW_MS'] = before;
  }
};

it('says a git call slower than the limit once, with its arguments and its time', async () => {
  const heard: string[] = [];
  onSlowGit((line) => { heard.push(line); });
  const real = Date.now;
  let first = true;
  const now = vi.spyOn(Date, 'now').mockImplementation(() => {
    if (first) { first = false; return 1_000; }
    return 1_000 + SLOW_GIT_MS + 500;
  });
  try {
    await withSlowLimit(undefined, async () => {
      await versionOf();
      await closedNow();
    });
  }
  finally {
    now.mockRestore();
    onSlowGit(undefined);
  }
  expect(Date.now).toBe(real);
  expect(heard).toEqual([`slow git: ${String(SLOW_GIT_MS + 500)} ms for git --version in ${root}`]);
});

it('says nothing of a git call within the limit', async () => {
  const heard: string[] = [];
  onSlowGit((line) => { heard.push(line); });
  try {
    await withSlowLimit(undefined, async () => {
      await versionOf();
      await closedNow();
    });
  }
  finally {
    onSlowGit(undefined);
  }
  expect(heard).toEqual([]);
});

it('writes a slow git call to stderr where AHPD_GIT_SLOW_MS is set', async () => {
  const written: string[] = [];
  const write = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    written.push(String(chunk));
    return true;
  });
  let first = true;
  const now = vi.spyOn(Date, 'now').mockImplementation(() => {
    if (first) { first = false; return 1_000; }
    return 1_010;
  });
  try {
    await withSlowLimit('1', async () => {
      await versionOf();
      await closedNow();
    });
  }
  finally {
    now.mockRestore();
    write.mockRestore();
  }
  expect(written.filter((line) => line.startsWith('slow git: '))).toEqual([`slow git: 10 ms for git --version in ${root}\n`]);
});
