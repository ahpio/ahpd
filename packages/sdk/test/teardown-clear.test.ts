import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { clearFolder, holders } from '../../../tools/holders.ts';

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
