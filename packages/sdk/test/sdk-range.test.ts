import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { clearFolder } from '../../../tools/holders.ts';

/*
 * The range script, run the way CI runs it.
 *
 * A copy of it in a folder of its own, beside a `packages/` it reads and
 * writes, so a case changes a file and never one that ships: the script finds
 * the packages relative to itself.
 */

const SCRIPT = fileURLToPath(new URL('../../../scripts/sdk-range.mjs', import.meta.url));

let root: string | undefined;

afterEach(() => {
  if (root !== undefined) clearFolder(root);
  root = undefined;
});

/** A checkout with the sdk at `sdk` and each package's manifest, the script copied in. */
const checkout = (sdk: string, packages: Record<string, object>): string => {
  root = mkdtempSync(join(tmpdir(), 'ahpd-sdk-range-'));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(SCRIPT, join(root, 'scripts', 'sdk-range.mjs'));
  const all: Record<string, object> = { sdk: { name: '@ahpd/sdk', version: sdk }, ...packages };
  for (const [folder, manifest] of Object.entries(all)) {
    mkdirSync(join(root, 'packages', folder), { recursive: true });
    writeFileSync(join(root, 'packages', folder, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return root;
};

const run = (at: string, ...args: string[]) =>
  spawnSync(process.execPath, [join(at, 'scripts', 'sdk-range.mjs'), ...args], { encoding: 'utf8' });

const manifest = (at: string, folder: string): string => readFileSync(join(at, 'packages', folder, 'package.json'), 'utf8');

/** A plugin as the repository writes one: the range as a peer, the workspace sdk as a dev dependency. */
const plugin = (name: string, range: string): object => ({
  name, version: '0.15.0-rc.4', peerDependencies: { '@ahpd/sdk': range }, devDependencies: { '@ahpd/sdk': 'workspace:*' },
});

it.each([
  ['0.15.0-rc.4', '>=0.15.0-rc.4 <0.16.0-0'],
  ['0.15.0', '>=0.15.0 <0.16.0-0'],
  ['1.2.3', '>=1.2.3 <1.3.0-0'],
])('passes on sdk %s when each plugin declares %s', (sdk, range) => {
  const at = checkout(sdk, { acp: plugin('@ahpd/agent-acp', range) });
  expect(run(at).status).toBe(0);
});

it('names each plugin with another range, and exits 1', () => {
  const at = checkout('0.15.0-rc.4', { acp: plugin('@ahpd/agent-acp', '>=0.14 <1'), bot: plugin('@ahpd/bot', '>=0.15.0-rc.4 <0.16.0-0') });
  const ran = run(at);
  expect(ran.status).toBe(1);
  expect(ran.stderr).toContain('@ahpd/agent-acp: >=0.14 <1, not >=0.15.0-rc.4 <0.16.0-0');
  expect(ran.stderr).not.toContain('@ahpd/bot:');
});

it('writes only the peer range of each plugin, and a check after it passes', () => {
  const at = checkout('0.15.0-rc.4', {
    acp: plugin('@ahpd/agent-acp', '>=0.14 <1'),
    server: { name: '@ahpd/server', version: '0.15.0-rc.4', dependencies: { '@ahpd/sdk': 'workspace:*' } },
    secret: { name: '@ahpd/secret', private: true, peerDependencies: { '@ahpd/sdk': '>=0.14 <1' } },
  });
  const before = { acp: manifest(at, 'acp'), server: manifest(at, 'server'), secret: manifest(at, 'secret') };
  expect(run(at, '--write').status).toBe(0);
  expect(manifest(at, 'acp')).toBe(before.acp.replace('"@ahpd/sdk": ">=0.14 <1"', '"@ahpd/sdk": ">=0.15.0-rc.4 <0.16.0-0"'));
  expect(manifest(at, 'acp')).toContain('"@ahpd/sdk": "workspace:*"');
  expect(manifest(at, 'server')).toBe(before.server);
  expect(manifest(at, 'secret')).toBe(before.secret);
  expect(run(at).status).toBe(0);
});
