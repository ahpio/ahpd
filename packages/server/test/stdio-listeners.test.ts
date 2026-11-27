/*
 * A `--stdio` daemon whose configuration file opens listeners.
 *
 * A box's host, started by another host over ssh, reads the box's own file,
 * which may serve the box's own daemon with `httpApi`, `modelApi` or `routes`.
 * A host on `--stdio` has no port, so it leaves each of them out, says so on
 * stderr, and answers its client.
 *
 * Every run gets temporary configuration, data and state directories, so
 * nothing here reads or writes the configuration of whoever runs the suite.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { clearFolder } from '../../../tools/holders.ts';

const REPO = join(import.meta.dirname, '../../..');
const MAIN = 'packages/server/src/main.ts';

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ahpd-stdio-listeners-'));
  mkdirSync(join(home, 'ahpd'), { recursive: true });
});
afterEach(() => { clearFolder(home); });

/** The child's environment: its own directories, and no model credentials. */
const environment = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_CONFIG_HOME: home,
    XDG_DATA_HOME: join(home, 'data'),
    XDG_STATE_HOME: join(home, 'state'),
    XDG_CACHE_HOME: join(home, 'cache'),
    CI: '1',
    NODE_OPTIONS: '--conditions development --import ./scripts/dev.mjs',
  };
  for (const key of Object.keys(env)) {
    if (key.startsWith('CLAUDE') || key.startsWith('ANTHROPIC')) delete env[key];
  }
  return env;
};

const HANDSHAKE = JSON.stringify({
  id: 1,
  method: 'initialize',
  params: { clientId: 'probe', protocolVersions: ['0.9.0'], initialSubscriptions: ['ahp-root://'] },
});

/** A stdio daemon over `config`, asked for its handshake: its answer and its stderr. */
const handshake = (config: Record<string, unknown>): Promise<{ answer?: Record<string, unknown>; stderr: string; code: number | null }> => {
  const file = join(home, 'config.json');
  writeFileSync(file, JSON.stringify({ plugins: ['./packages/server/test/fixtures/plugin-echo'], ...config }));
  const child = spawn(process.execPath, [MAIN, '--stdio', '--config-file', file, '--no-update-check'], {
    cwd: REPO,
    env: environment(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '';
  let held = '';
  let answer: Record<string, unknown> | undefined;
  child.stderr.on('data', (chunk: Buffer) => { stderr += String(chunk); });
  child.stdout.on('data', (chunk: Buffer) => {
    held += String(chunk);
    for (let at = held.indexOf('\n'); at !== -1; at = held.indexOf('\n')) {
      const line = held.slice(0, at);
      held = held.slice(at + 1);
      try {
        const frame = JSON.parse(line) as { id?: number; result?: Record<string, unknown> };
        if (frame.id === 1) {
          answer = frame.result;
          child.stdin.end();
        }
      }
      catch { /* not a frame */ }
    }
  });
  child.stdin.write(`${HANDSHAKE}\n`);
  return new Promise((done) => {
    // A daemon that never answers is a case that failed, so it is ended rather than waited on.
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 25_000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      done({ ...(answer === undefined ? {} : { answer }), stderr, code });
    });
  });
};

it('leaves out httpApi, modelApi and routes from its file, says so for each, and answers', async () => {
  const run = await handshake({ httpApi: { port: 0 }, modelApi: true, routes: { port: 0 } });
  expect(run.answer, run.stderr).toBeDefined();
  for (const key of ['httpApi', 'modelApi', 'routes']) {
    expect(run.stderr).toContain(`${key} is left out: --stdio serves one connection on this process's own pipes, and no port.`);
  }
  // Nothing about a credential: no listener is opened for the API to need one.
  expect(run.stderr).not.toContain('needs a credential');
}, 40_000);

it('says nothing of a key its file does not set', async () => {
  const run = await handshake({});
  expect(run.answer, run.stderr).toBeDefined();
  expect(run.stderr).not.toContain('is left out');
}, 40_000);
