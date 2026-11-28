import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { expect, it } from 'vitest';
import { ownedBy, stopCli } from '../src/session/clis.js';
import { ownSpawn, withStderr } from '../src/session/ownspawn.js';
import type { OwnCli } from '../src/session/ownspawn.js';
import type { SpawnedProcess } from '../src/spawn.js';

/*
 * The CLI as this host spawns it: a start waits for the process of the CLI
 * before it to exit, which the SDK's close does not, and a CLI that exits
 * badly is reported with the end of its stderr, as the SDK reports its own.
 */

it('spawns a CLI on this host, says when it has exited, and keeps the end of its stderr', async () => {
  let cli: OwnCli | undefined;
  const child = ownSpawn(undefined, (one) => { cli = one; })({
    command: process.execPath,
    args: ['-e', 'process.stderr.write("the CLI broke\\n"); process.exit(3)'],
    env: { ...process.env },
  });
  child.stdin.end();
  child.stdout.resume();
  await cli?.exited;
  expect(child.exitCode).toBe(3);
  expect(cli?.stderrTail()).toBe('the CLI broke');
  expect(withStderr('Claude Code process exited with code 3', cli)).toBe('Claude Code process exited with code 3. stderr: the CLI broke');
  expect(withStderr('The session was disposed', cli)).toBe('The session was disposed');
});

it('hands a CLI in a machine to the session\'s own hook, and says when it has exited', async () => {
  const events = new EventEmitter();
  const inside = Object.assign(events, {
    stdin: new PassThrough(), stdout: new PassThrough(), killed: false, exitCode: null as number | null,
    kill: () => true,
  }) as unknown as SpawnedProcess;
  let cli: OwnCli | undefined;
  const child = ownSpawn(() => inside, (one) => { cli = one; })({ command: 'claude', args: [], env: {} });
  expect(child).toBe(inside);
  let gone = false;
  void cli?.exited.then(() => { gone = true; });
  await new Promise((r) => { setTimeout(r, 10); });
  expect(gone).toBe(false);
  events.emit('exit', 0, null);
  await cli?.exited;
  expect(gone).toBe(true);
});

it('waits for the process of a CLI it closes, past the SDK\'s own close', async () => {
  let exit: () => void = () => {};
  const exited = new Promise<void>((done) => { exit = done; });
  const handle = { [Symbol.asyncDispose]: async () => {} };
  ownedBy(handle, { exited, stderrTail: () => '' });
  let stopped = false;
  void stopCli(handle).then(() => { stopped = true; });
  await new Promise((r) => { setTimeout(r, 10); });
  expect(stopped).toBe(false);
  exit();
  await new Promise((r) => { setTimeout(r, 10); });
  expect(stopped).toBe(true);
});
