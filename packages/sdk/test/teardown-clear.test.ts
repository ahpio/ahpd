import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { clearFolder, holders, removeFolder } from '../../../tools/holders.ts';

it('ends a child whose environment names the folder, then removes the folder', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'ahpd-clear-'));
  writeFileSync(join(folder, 'note'), 'held');
  // A child that keeps writing in the folder, told it through its environment.
  const child = spawn(process.execPath, ['-e', 'setInterval(() => require("fs").writeFileSync(require("path").join(process.env.HELD_FOLDER, "tick"), String(Date.now())), 20)'], {
    env: { ...process.env, HELD_FOLDER: folder },
    stdio: 'ignore',
  });
  const ended = new Promise((done) => { child.once('exit', done); });
  await new Promise((done) => { setTimeout(done, 100); });
  if (process.platform === 'linux') expect(holders([folder])).toContain(child.pid);
  clearFolder(folder);
  expect(existsSync(folder)).toBe(false);
  if (process.platform === 'linux') await ended;
  else child.kill('SIGKILL');
});

it('takes a folder that is not there', () => {
  expect(() => { clearFolder(join(tmpdir(), 'ahpd-clear-never-made')); }).not.toThrow();
});

/** An error with the code Node gives it. */
const failure = (code: string): NodeJS.ErrnoException => Object.assign(new Error(`${code}: the folder is held`), { code });

/*
 * Windows answers `EBUSY` while another process has the folder open, and
 * Node's synchronous `rm` does not try again for it, so `removeFolder` does.
 */
it('tries a busy folder again until it goes', () => {
  const folder = mkdtempSync(join(tmpdir(), 'ahpd-clear-'));
  let tries = 0;
  removeFolder(folder, undefined, {
    remove: (at) => {
      tries += 1;
      if (tries <= 2) throw failure('EBUSY');
      rmSync(at, { recursive: true, force: true });
    },
  });
  expect(tries).toBe(3);
  expect(existsSync(folder)).toBe(false);
});

it('gives up on a folder that stays busy, and says how long it tried', () => {
  const folder = mkdtempSync(join(tmpdir(), 'ahpd-clear-'));
  let tries = 0;
  const began = Date.now();
  expect(() => {
    removeFolder(folder, undefined, { ms: 300, remove: () => { tries += 1; throw failure('EBUSY'); } });
  }).toThrow(/EBUSY: the folder is held, after \d+ tries in \d+ms\. Still in it/);
  expect(Date.now() - began).toBeGreaterThanOrEqual(300);
  // A pause between tries, and the last try at the limit.
  expect(tries).toBeGreaterThanOrEqual(2);
  rmSync(folder, { recursive: true, force: true });
});

it('fails at once on an error a later try cannot get past', () => {
  const folder = mkdtempSync(join(tmpdir(), 'ahpd-clear-'));
  let tries = 0;
  expect(() => {
    removeFolder(folder, undefined, { remove: () => { tries += 1; throw failure('EACCES'); } });
  }).toThrow(/EACCES: the folder is held, after 1 try in \d+ms/);
  expect(tries).toBe(1);
  rmSync(folder, { recursive: true, force: true });
});
