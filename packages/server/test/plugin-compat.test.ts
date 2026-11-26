import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOffered, newestFitting, satisfies } from '../src/compat.js';
import { loadPlugins } from '../src/plugins.js';
import { sdkVersion } from '../../sdk/src/version.js';
import { echo } from '../../../examples/echo/agent.js';
import type { HostOptions } from '../../sdk/src/types/host.js';
import { clearFolder } from '../../../tools/holders.ts';

/*
 * The range check, and the one moment it matters.
 *
 * `satisfies` is a table because a hand-written comparison is exactly the kind
 * of thing that is wrong in one corner; the loader half is here because the
 * point of checking compatibility is that the check happens *before* the
 * import, and a fixture that records its own import is the only way to pin the
 * order rather than assume it.
 */

const here = import.meta.dirname;
const fixtures = join(here, './fixtures');

const load = (specs: Parameters<typeof loadPlugins>[0]) => loadPlugins(specs, {
  base: { path: '/tmp/plugin-compat', agents: [echo({ path: '/tmp/plugin-compat' })] } satisfies HostOptions,
  configDir: fixtures,
  cwd: here,
  log: () => {},
});

describe('satisfies', () => {
  it.each([
    ['0.6.0', '*', true],
    ['0.6.0', '0.6.0', true],
    ['0.6.1', '0.6.0', false],
    ['0.6.0', '=0.6.0', true],
    ['0.6.0', '^0.6.0', true],
    ['0.6.9', '^0.6.0', true],
    ['0.7.0', '^0.6.0', false],
    ['1.0.0', '^1.2.3', false],
    ['1.2.9', '~1.2.3', true],
    ['1.3.0', '~1.2.3', false],
    ['0.6.5', '>=0.6 <0.7', true],
    ['0.7.0', '>=0.6 <0.7', false],
    ['0.6.0', '>=0.6.0', true],
    ['0.6.0', '<=0.6.0', true],
    ['0.6.1', '<=0.6.0', false],
    ['0.6.0', '0.5.0', false],
  ])('%s against %s is %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  // A peer range is written in npm's grammar, which node-semver reads
  // (https://github.com/npm/node-semver#ranges).
  it.each([
    ['0.6.0', '^0.5.0 || ^0.6.0', true],
    ['0.6.5', '0.6.0 - 0.7.0', true],
    ['0.6.5', '0.6.x', true],
    ['0.7.0', '0.6.x', false],
    ['0.6.0', '>= 0.6', true],
  ])('reads %s against %s, of the rest of npm\'s grammar, as %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it('refuses a range it cannot read, by name', () => {
    expect(() => satisfies('0.6.0', 'banana')).toThrow(/banana/);
  });

  // A first-party range starts at the sdk of its release and ends before the
  // next minor's first prerelease.
  it.each([
    ['0.15.0-rc.4', '>=0.15.0-rc.4 <0.16.0-0', true],
    ['0.15.0-rc.3', '>=0.15.0-rc.4 <0.16.0-0', false],
    ['0.15.0', '>=0.15.0-rc.4 <0.16.0-0', true],
    ['0.15.3', '>=0.15.0-rc.4 <0.16.0-0', true],
    ['0.16.0-rc.1', '>=0.15.0-rc.4 <0.16.0-0', false],
    ['0.16.0', '>=0.15.0 <0.16.0-0', false],
  ])('reads sdk %s against the release range %s as %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });
});

describe('isOffered', () => {
  it.each([
    ['0.14.0', '0.15.0', true],
    ['0.14.0', '0.15.0-rc.3', true],
    ['0.15.0-rc.3', '0.15.0', false],
    ['0.15.0-rc.3', '0.15.0-rc.3', true],
    ['2.0.0-beta.1', '0.15.0-rc.3', true],
    ['0.15.0-rc.3', 'unknown', false],
    ['not-a-version', '0.15.0-rc.3', false],
  ])('considers %s on sdk %s: %s', (version, sdk, expected) => {
    expect(isOffered(version, sdk)).toBe(expected);
  });
});

describe('newestFitting', () => {
  it('orders a prerelease before its release, and after the release before it', () => {
    const offered = ['0.14.0', '0.15.0-rc.10', '0.15.0-rc.2'].map((version) => ({ version, range: '>=0.10 <1' }));
    expect(newestFitting('agent-acp', offered, '0.15.0-rc.3')).toBe('0.15.0-rc.10');
    expect(newestFitting('agent-acp', [...offered, { version: '0.15.0', range: '>=0.10 <1' }], '0.15.0-rc.3')).toBe('0.15.0');
  });

  it('refuses a release candidate built on a later sdk than the one shipped', () => {
    const offered = [{ version: '0.15.0-rc.3', range: '>=0.15.0-rc.3 <0.16.0-0' }, { version: '0.15.0-rc.4', range: '>=0.15.0-rc.4 <0.16.0-0' }];
    expect(newestFitting('agent-acp', offered, '0.15.0-rc.3')).toBe('0.15.0-rc.3');
    expect(newestFitting('agent-acp', offered, '0.15.0-rc.4')).toBe('0.15.0-rc.4');
  });
});

describe('a plugin that declares a range', () => {
  it('is refused before its entry is imported, naming the range and the version', async () => {
    delete (globalThis as Record<string, unknown>).__pluginIncompatibleImported;
    const { loaded, problems } = await load(['./fixtures/plugin-incompatible']);

    expect(loaded).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('^99.0.0');
    expect(problems[0]).toContain(sdkVersion());
    expect((globalThis as Record<string, unknown>).__pluginIncompatibleImported).toBeUndefined();
  });

  it('loads a plugin that declares no range, because absent is not incompatible', async () => {
    const { loaded, problems } = await load(['./fixtures/plugin-no-peer']);

    expect(problems).toEqual([]);
    expect(loaded.map((one) => one.name)).toEqual(['no-peer']);
  });
});

describe('a plugin that names the oldest sdk it needs', () => {
  /** A plugin in a scratch directory whose `@ahpd/sdk` peer range is `range`, loaded on a daemon at `version`. */
  const loadWith = async (range: string, version: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'ahpd-compat-'));
    try {
      mkdirSync(join(dir, 'plugin'));
      writeFileSync(join(dir, 'plugin', 'package.json'), JSON.stringify({
        name: 'oldest-sdk', version: '1.0.0', type: 'module',
        peerDependencies: { '@ahpd/sdk': range }, ahpd: { entry: './index.js' },
      }));
      writeFileSync(join(dir, 'plugin', 'index.js'), "export const name = 'oldest-sdk';\nexport const apply = () => {};\n");
      return await loadPlugins([join(dir, 'plugin')], {
        base: { path: '/tmp/plugin-compat', agents: [echo({ path: '/tmp/plugin-compat' })] },
        configDir: dir, cwd: dir, log: () => {}, version,
      });
    }
    finally {
      clearFolder(dir);
    }
  };

  it('loads a plugin that takes >=0.8 on a 0.9 daemon', async () => {
    const { loaded, problems } = await loadWith('>=0.8', '0.9.0');
    expect(problems).toEqual([]);
    expect(loaded.map((one) => one.name)).toEqual(['oldest-sdk']);
  });

  it('refuses a plugin that takes >=0.9 on a 0.8 daemon, with the loader\'s sentence', async () => {
    const { loaded, problems } = await loadWith('>=0.9', '0.8.0');
    expect(loaded).toEqual([]);
    expect(problems).toEqual(['plugin oldest-sdk needs @ahpd/sdk >=0.9, this is 0.8.0']);
  });

  /*
   * Each package's range is the one its release sets: from the sdk this
   * workspace builds to the next minor, which `scripts/sdk-range.mjs` writes and
   * CI checks. A daemon of an older minor refuses it, and so does the next.
   */
  const PLUGINS = [
    'activepieces', 'agent-acp', 'agent-claude', 'agent-cofold', 'agent-pi', 'bot', 'computer', 'push', 'tasks',
    'tunnel-devtunnel', 'webhook',
  ];

  it.each(PLUGINS)(
    'declares @ahpd/%s as taking the sdk of its release up to the next minor',
    (name) => {
      const manifest = JSON.parse(readFileSync(join(here, '../..', name, 'package.json'), 'utf8')) as {
        peerDependencies: Record<string, string>;
      };
      const range = manifest.peerDependencies['@ahpd/sdk'] as string;
      const [major, minor] = sdkVersion().split('.').map(Number) as [number, number];
      expect(range).toBe(`>=${sdkVersion()} <${String(major)}.${String(minor + 1)}.0-0`);
      expect(satisfies(sdkVersion(), range)).toBe(true);
      expect(satisfies(`${String(major)}.${String(minor - 1)}.0`, range)).toBe(false);
      expect(satisfies(`${String(major)}.${String(minor + 1)}.0-rc.1`, range)).toBe(false);
    },
  );
});
