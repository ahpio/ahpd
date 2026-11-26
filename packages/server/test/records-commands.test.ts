/*
 * Every records channel the daemon serves has the commands that change it.
 *
 * A list a client reads through `x-ahpd-<domain>://` is changed through
 * `x-ahpd/<domain>/put` (or `/create`) and `x-ahpd/<domain>/remove`, so a
 * client never falls back to `resourceWrite` for a list it reads by channel.
 * A channel whose rows nobody makes by hand is on `READ_ONLY`, with why.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { clearFolder } from '../../../tools/holders.ts';

const REPO = join(import.meta.dirname, '../../..');
const MAIN = 'packages/server/src/main.ts';

/** The bundled plugins that serve a channel. */
const PLUGINS = ['bot', 'push', 'tasks', 'computer'].map((one) => `./packages/${one}/src/index.ts`);

/** The channels with no make and remove commands, each with why. */
const READ_ONLY: Record<string, string> = {
  'x-ahpd-adapters': 'an adapter is what a plugin registers',
  'x-ahpd-engines': 'an engine is what a plugin registers',
  'x-ahpd-clients': 'a client is listed by connecting',
  'x-ahpd-summary': 'counts over the other lists',
  'x-ahpd-plans': 'a plan is written in its repository',
  'x-ahpd-plugins': 'the configuration file is changed with x-ahpd/plugins/write',
  'x-ahpd-tunnels': 'a tunnel is what a plugin opens',
};

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'ahpd-records-commands-')); });
afterEach(() => { clearFolder(home); });

/** What `initialize` answered a daemon with the bundled plugins and a users file. */
const advertised = async (): Promise<{ channels: string[]; methods: string[] }> => {
  mkdirSync(join(home, 'ahpd'), { recursive: true });
  const users = join(home, 'users.json');
  writeFileSync(users, JSON.stringify({ roles: {}, users: [] }));
  const config = join(home, 'config.json');
  writeFileSync(config, JSON.stringify({ plugins: PLUGINS, users }));
  const child = spawn(process.execPath, [MAIN, '--stdio', '--config-file', config, '--no-update-check'], {
    cwd: REPO,
    env: { ...process.env, XDG_CONFIG_HOME: home, XDG_STATE_HOME: home, XDG_DATA_HOME: home, CI: '1', NODE_OPTIONS: '--conditions development --import ./scripts/dev.mjs' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const ready = await new Promise<Record<string, any>>((done, fail) => {
    let held = '';
    const give = setTimeout(() => { child.kill(); fail(new Error('no answer to initialize')); }, 30_000);
    child.stdout.on('data', (chunk: Buffer) => {
      held += String(chunk);
      for (const line of held.split('\n')) {
        if (!line.startsWith('{')) continue;
        const frame = JSON.parse(line) as { id?: number; result?: Record<string, any> };
        if (frame.id === 1 && frame.result !== undefined) {
          clearTimeout(give);
          done(frame.result);
        }
      }
    });
    child.stdin.write(`${JSON.stringify({ id: 1, method: 'initialize', params: { clientId: 'probe', protocolVersions: ['0.9.0'] } })}\n`);
  });
  child.stdin.end();
  await new Promise((done) => { child.on('exit', done); });
  const meta = ready._meta as Record<string, any>;
  return {
    channels: ((meta['ahpd.channels'] ?? []) as { scheme: string }[]).map((one) => one.scheme),
    methods: ((meta['ahpd.methods'] ?? []) as { method: string }[]).map((one) => one.method),
  };
};

it('serves a make and a remove command for every records channel', async () => {
  const { channels, methods } = await advertised();
  // The lists this guard is about are all here, so a channel left out of the
  // daemon is not a pass.
  expect(channels).toEqual(expect.arrayContaining(['x-ahpd-users', 'x-ahpd-bots', 'x-ahpd-push', 'x-ahpd-computers', 'x-ahpd-connectors']));

  const missing = channels
    .filter((scheme) => scheme.startsWith('x-ahpd-') && READ_ONLY[scheme] === undefined)
    .filter((scheme) => {
      const domain = scheme.slice('x-ahpd-'.length);
      const makes = methods.includes(`x-ahpd/${domain}/put`) || methods.includes(`x-ahpd/${domain}/create`);
      return !makes || !methods.includes(`x-ahpd/${domain}/remove`);
    });
  expect(missing).toEqual([]);
}, 60_000);
