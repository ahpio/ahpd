import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pluginFilesPath, pluginMarketplacesPath } from '../src/config.js';
import {
  availablePlugins, deprecationOf, fittingListed, forgetInstalled, installedFiles, installedListing, LIST_LIMIT, listedDetails, listedEntries, listedVersions,
  marketplaceName, readInstalled, readKept, readMarketplaces, recordInstalled, refreshMarketplace, refreshMarketplaces, staleList,
} from '../src/pluginlist.js';
import type { ListedPlugin, ListedVersion } from '../src/pluginlist.js';
import type { Fetch } from '../src/update.js';
import { clearFolder } from '../../../tools/holders.ts';

/*
 * The plugin lists, without a network.
 *
 * Every fetch is a stub that answers what the case needs and records what it
 * was sent, and the lists are kept under a configuration folder that is thrown
 * away after each case. No case reaches plugins.ahpio.com.
 */

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ahpd-pluginlist-')); });
afterEach(() => { clearFolder(dir); });

const OURS = 'https://plugins.example.com/v1/plugins.json';
const THEIRS = 'https://other.example.com/v1/plugins.json';

/** One listed version, `0.14.0` by default, with the files a version has. */
const aVersion = (version = '0.14.0', more: Partial<ListedVersion> = {}): ListedVersion => ({
  version,
  sdk: '>=0.10 <1',
  integrity: `sha512-${version}`,
  published: '2026-10-26T06:53:58.372Z',
  files: {
    download: `https://registry.example.com/agent-acp-${version}.tgz`,
    manifest: `https://plugins.example.com/v1/agent-acp/${version}/package.json`,
    readme: `https://plugins.example.com/v1/agent-acp/${version}/README.md`,
  },
  ...more,
});

/** One listed plugin, agent-acp by default. */
const aPlugin = (more: Partial<ListedPlugin> = {}): ListedPlugin => ({
  id: 'agent-acp',
  name: 'Agent ACP',
  description: 'Connects any ACP-compatible agent.',
  source: '@ahpd/agent-acp',
  versions: [aVersion('0.14.0'), aVersion('0.13.0')],
  ...more,
});

/** A list body of format 1. */
const aList = (plugins: ListedPlugin[] = [aPlugin()]): object => ({ version: 1, plugins });

/** A fetch that answers each URL from `answers`, and records each request with its headers. */
const stub = (answers: Record<string, (init: RequestInit | undefined) => Response>) => {
  const asked: { url: string; headers: Record<string, string> }[] = [];
  const fetch: Fetch = async (url, init) => {
    asked.push({ url: String(url), headers: { ...(init?.headers as Record<string, string> | undefined) } });
    const answer = answers[String(url)];
    if (answer === undefined) return new Response('not here', { status: 404 });
    return answer(init);
  };
  return { fetch, asked };
};

/** An answer of a list body with an `ETag`, and a 304 when the request sends that `ETag` back. */
const served = (body: object, etag = '"one"') => (init: RequestInit | undefined): Response => {
  const sent = (init?.headers as Record<string, string> | undefined)?.['if-none-match'];
  if (sent === etag) return new Response(null, { status: 304 });
  return Response.json(body, { headers: { etag } });
};

/** Keep a list for `url` as a fetch would have. */
const keep = async (url: string, body: object): Promise<void> => {
  const { fetch } = stub({ [url]: served(body) });
  expect(await refreshMarketplace({ url, version: '0.15.0', dir, fetch })).toBe('written');
};

describe('refreshMarketplace', () => {
  it('keeps a 200 with its ETag, and sends ahpd/<version> as its User-Agent', async () => {
    const { fetch, asked } = stub({ [OURS]: served(aList()) });
    expect(await refreshMarketplace({ url: OURS, version: '0.15.0', dir, fetch })).toBe('written');
    expect(asked[0]?.headers['user-agent']).toBe('ahpd/0.15.0');
    expect(asked[0]?.headers['if-none-match']).toBeUndefined();
    const kept = readKept(OURS, dir);
    expect(kept?.etag).toBe('"one"');
    expect(kept?.list.plugins[0]?.id).toBe('agent-acp');
    expect(existsSync(join(pluginMarketplacesPath(dir), `${marketplaceName(OURS)}.json`))).toBe(true);
  });

  it('names the file by the first 16 hex digits of the URL\'s SHA-256, and keeps the URL in it', async () => {
    await keep(OURS, aList());
    expect(marketplaceName(OURS)).toMatch(/^[0-9a-f]{16}$/u);
    const held = JSON.parse(readFileSync(join(pluginMarketplacesPath(dir), `${marketplaceName(OURS)}.json`), 'utf8')) as { url: string };
    expect(held.url).toBe(OURS);
  });

  it('sends the ETag back, and on a 304 writes only checkedAt', async () => {
    await keep(OURS, aList());
    const before = readKept(OURS, dir);
    await new Promise((done) => { setTimeout(done, 5); });
    const { fetch, asked } = stub({ [OURS]: served(aList([])) });
    expect(await refreshMarketplace({ url: OURS, version: '0.15.0', dir, fetch })).toBe('kept');
    expect(asked[0]?.headers['if-none-match']).toBe('"one"');
    const after = readKept(OURS, dir);
    expect(after?.list).toEqual(before?.list);
    expect(after?.checkedAt).not.toBe(before?.checkedAt);
  });

  it.each([
    ['a 500', () => new Response('down', { status: 500 }), 'answered 500'],
    ['a body that is not JSON', () => new Response('<html>portal</html>', { status: 200 }), 'not JSON'],
    ['a list of format 2', () => Response.json({ version: 2, plugins: [] }), 'format 2, not 1'],
    ['a body with no plugins array', () => Response.json({ version: 1 }), 'not a plugin list'],
    ['a body over the limit', () => new Response('x'.repeat(LIST_LIMIT + 1), { status: 200 }), `larger than ${String(LIST_LIMIT)} bytes`],
  ])('leaves the file as it was on %s, and says why', async (_name, answer, why) => {
    await keep(OURS, aList());
    const before = readFileSync(join(pluginMarketplacesPath(dir), `${marketplaceName(OURS)}.json`), 'utf8');
    const { fetch } = stub({ [OURS]: answer });
    const lines: string[] = [];
    expect(await refreshMarketplace({ url: OURS, version: '0.15.0', dir, fetch, log: (line) => lines.push(line) })).toBe('failed');
    expect(readFileSync(join(pluginMarketplacesPath(dir), `${marketplaceName(OURS)}.json`), 'utf8')).toBe(before);
    expect(lines).toEqual([`plugin list ${OURS}: ${why}; the list kept is used`]);
  });

  it('leaves no file when a fetch throws and there was none', async () => {
    const fetch: Fetch = async () => { throw new Error('offline'); };
    expect(await refreshMarketplace({ url: OURS, version: '0.15.0', dir, fetch })).toBe('failed');
    expect(readKept(OURS, dir)).toBeUndefined();
  });
});

describe('refreshMarketplaces', () => {
  it('fetches only a list older than the period', async () => {
    await keep(OURS, aList());
    const { fetch, asked } = stub({ [OURS]: served(aList()), [THEIRS]: served(aList()) });
    await refreshMarketplaces({ urls: [OURS, THEIRS], dir, version: '0.15.0', maxAgeMs: 12 * 60 * 60 * 1000, fetch });
    expect(asked.map((one) => one.url)).toEqual([THEIRS]);
    expect(staleList(OURS, dir, 12 * 60 * 60 * 1000)).toBe(false);
  });

  it('removes the file of a list the configuration no longer names, and keeps installed.json', async () => {
    await keep(OURS, aList());
    await keep(THEIRS, aList());
    recordInstalled(dir, '@ahpd/agent-acp', { marketplace: THEIRS, source: '@ahpd/agent-acp' });
    const { fetch } = stub({});
    await refreshMarketplaces({ urls: [OURS], dir, version: '0.15.0', maxAgeMs: 60_000, fetch });
    expect(readdirSync(pluginMarketplacesPath(dir)).sort()).toEqual([`${marketplaceName(OURS)}.json`, 'installed.json'].sort());
  });

  it('answers whether it wrote a new list', async () => {
    const { fetch } = stub({ [OURS]: served(aList()) });
    expect(await refreshMarketplaces({ urls: [OURS], dir, version: '0.15.0', maxAgeMs: 0, fetch })).toBe(true);
    expect(await refreshMarketplaces({ urls: [OURS], dir, version: '0.15.0', maxAgeMs: 0, fetch })).toBe(false);
  });
});

describe('readMarketplaces and listedEntries', () => {
  it('answers each list in order, missing until it is fetched', async () => {
    await keep(THEIRS, aList());
    const read = readMarketplaces({ urls: [OURS, THEIRS], dir });
    expect(read.map((one) => [one.url, one.state])).toEqual([[OURS, 'missing'], [THEIRS, 'on']]);
  });

  it('keeps two entries with the same id, each with its marketplace', async () => {
    await keep(OURS, aList());
    await keep(THEIRS, aList([aPlugin({ description: 'Theirs.' }), aPlugin({ id: 'web', source: 'github:ahpio/ahpw' })]));
    const entries = listedEntries({ urls: [OURS, THEIRS], dir });
    expect(entries.map((one) => [one.plugin.id, one.marketplace])).toEqual([
      ['agent-acp', OURS], ['agent-acp', THEIRS], ['web', THEIRS],
    ]);
  });

  it('leaves out an entry with no id, source or versions', async () => {
    await keep(OURS, { version: 1, plugins: [{ id: 'x' }, { source: 'y', versions: [] }, aPlugin()] });
    expect(listedEntries({ urls: [OURS], dir }).map((one) => one.plugin.id)).toEqual(['agent-acp']);
  });
});

describe('listedVersions', () => {
  beforeEach(async () => {
    await keep(OURS, aList());
    await keep(THEIRS, aList([aPlugin({ versions: [aVersion('0.20.0')] }), aPlugin({ id: 'web', source: 'github:ahpio/ahpw', versions: [aVersion('0.8.0', { commit: 'abc' })] })]));
  });

  it('takes the first marketplace that lists the source', () => {
    expect(listedVersions('@ahpd/agent-acp', { urls: [OURS, THEIRS], dir })?.marketplace).toBe(OURS);
    expect(listedVersions('github:ahpio/ahpw', { urls: [OURS, THEIRS], dir })?.marketplace).toBe(THEIRS);
    expect(listedVersions('@ahpd/agent-pi', { urls: [OURS, THEIRS], dir })).toBeUndefined();
  });

  it('takes the marketplace named', () => {
    expect(listedVersions('@ahpd/agent-acp', { urls: [OURS, THEIRS], dir, marketplace: THEIRS })?.plugin.versions[0]?.version).toBe('0.20.0');
  });

  it('refuses a marketplace not in pluginMarketplaces, and one that does not list the source', () => {
    expect(() => listedVersions('@ahpd/agent-acp', { urls: [OURS], dir, marketplace: THEIRS })).toThrow(`${THEIRS} is not in pluginMarketplaces.`);
    expect(() => listedVersions('@ahpd/agent-pi', { urls: [OURS, THEIRS], dir, marketplace: THEIRS })).toThrow(`${THEIRS} does not list @ahpd/agent-pi.`);
  });

  it('takes the marketplace installed.json names before the first one', () => {
    recordInstalled(dir, '@ahpd/agent-acp', { marketplace: THEIRS, source: '@ahpd/agent-acp' });
    expect(listedVersions('@ahpd/agent-acp', { urls: [OURS, THEIRS], dir })?.marketplace).toBe(THEIRS);
    expect(installedListing('@ahpd/agent-acp', { urls: [OURS, THEIRS], dir })?.marketplace).toBe(THEIRS);
  });

  it('reads an installed github: package by the source installed.json keeps', () => {
    recordInstalled(dir, 'web', { marketplace: THEIRS, source: 'github:ahpio/ahpw' });
    expect(installedListing('web', { urls: [OURS, THEIRS], dir })?.plugin.id).toBe('web');
  });
});

describe('installed.json', () => {
  it('records and forgets a package', () => {
    recordInstalled(dir, '@ahpd/agent-acp', { marketplace: OURS, source: '@ahpd/agent-acp' });
    expect(readInstalled(dir)).toEqual({ '@ahpd/agent-acp': { marketplace: OURS, source: '@ahpd/agent-acp' } });
    forgetInstalled(dir, ['@ahpd/agent-acp']);
    expect(readInstalled(dir)).toEqual({});
  });
});

describe('fittingListed', () => {
  it('takes the newest version that fits, and skips a prerelease and a deprecated version on a release sdk', () => {
    const versions = [aVersion('0.16.0-rc.1'), aVersion('0.15.0', { deprecated: 'Use 0.14.0.' }), aVersion('0.14.0'), aVersion('0.13.0')];
    expect(fittingListed('agent-acp', versions, '0.15.1')?.version).toBe('0.14.0');
  });

  it('takes the listed release candidate whose range admits an sdk that is a release candidate', () => {
    const versions = [
      aVersion('0.15.0-rc.4', { sdk: '>=0.15.0-rc.4 <0.16.0-0' }),
      aVersion('0.15.0-rc.3', { sdk: '>=0.15.0-rc.3 <0.16.0-0' }),
      aVersion('0.14.0'),
    ];
    expect(fittingListed('agent-acp', versions, '0.15.0-rc.4')?.version).toBe('0.15.0-rc.4');
    expect(fittingListed('agent-acp', versions, '0.15.0-rc.3')?.version).toBe('0.15.0-rc.3');
    expect(fittingListed('agent-acp', versions, '0.14.0')?.version).toBe('0.14.0');
  });

  it('skips a deprecated release candidate', () => {
    const versions = [aVersion('0.15.0-rc.4', { deprecated: 'Broken.' }), aVersion('0.15.0-rc.3'), aVersion('0.14.0')];
    expect(fittingListed('agent-acp', versions, '0.15.0-rc.4')?.version).toBe('0.15.0-rc.3');
  });

  it('refuses with the newest version and its range when none fits', () => {
    expect(() => fittingListed('agent-acp', [aVersion('0.14.0', { sdk: '>=2' })], '0.15.0'))
      .toThrow('agent-acp has no version that admits @ahpd/sdk 0.15.0: its newest, 0.14.0, needs >=2.');
  });

  it('chooses nothing for an unknown daemon version', () => {
    expect(fittingListed('agent-acp', [aVersion()], 'unknown')).toBeUndefined();
  });
});

/** A data: URI of a small SVG, as an icon fetch would answer. */
const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const svgAnswer = (): Response => new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });

describe('availablePlugins', () => {
  it('answers each entry with its marketplace, its icons as data: URIs, and the installed id', async () => {
    await keep(OURS, aList([aPlugin({ icons: [{ src: 'https://plugins.example.com/icon.svg' }] })]));
    await keep(THEIRS, aList([aPlugin({ versions: [aVersion('0.13.0', { deprecated: 'Use 0.14.0.' })] })]));
    recordInstalled(dir, '@ahpd/agent-acp', { marketplace: THEIRS, source: '@ahpd/agent-acp' });
    const icons = stub({ 'https://plugins.example.com/icon.svg': svgAnswer });
    const answer = await availablePlugins({ sdk: '0.14.0',
      urls: [OURS, THEIRS, 'https://none.example.com/v1/plugins.json'],
      dir,
      installed: [{ id: 'agent-acp', name: '@ahpd/agent-acp', version: '0.13.0' }],
      icons: { problem: () => undefined, fetch: icons.fetch as typeof fetch },
    });
    expect(answer.marketplaces.map((one) => one.state)).toEqual(['on', 'on', 'missing']);
    expect(answer.plugins.map((one) => one.marketplace)).toEqual([OURS, THEIRS]);
    expect(answer.plugins[0]?.icons?.[0]?.src).toMatch(/^data:image\/svg\+xml/u);
    expect(answer.plugins[1]?.installed).toEqual({ id: 'agent-acp', version: '0.13.0', marketplace: THEIRS, deprecated: 'Use 0.14.0.' });
    expect(answer.plugins[0]?.installed).toEqual({ id: 'agent-acp', version: '0.13.0', marketplace: THEIRS });
  });

  it('keeps a fetched icon, so a second answer makes no request for it', async () => {
    await keep(OURS, aList([aPlugin({ icons: [{ src: 'https://plugins.example.com/icon.svg' }] })]));
    const icons = stub({ 'https://plugins.example.com/icon.svg': svgAnswer });
    const ask = () => availablePlugins({ sdk: '0.14.0', urls: [OURS], dir, installed: [], icons: { problem: () => undefined, fetch: icons.fetch as typeof fetch } });
    await ask();
    const second = await ask();
    expect(icons.asked).toHaveLength(1);
    expect(second.plugins[0]?.icons?.[0]?.src).toMatch(/^data:/u);
    expect(readdirSync(join(pluginFilesPath(dir), 'icons'))).toHaveLength(1);
  });
});

describe('availablePlugins lists the versions the daemon considers', () => {
  const withRc = () => aList([aPlugin({ versions: [aVersion('0.15.0-rc.4'), aVersion('0.14.0'), aVersion('0.13.0')] })]);

  it('with no prerelease on a release sdk', async () => {
    await keep(OURS, withRc());
    const answer = await availablePlugins({ sdk: '0.14.0', urls: [OURS], dir, installed: [], icons: { problem: () => undefined } });
    expect(answer.plugins[0]?.versions.map((one) => one.version)).toEqual(['0.14.0', '0.13.0']);
  });

  it('with the prereleases on an sdk that is a prerelease', async () => {
    await keep(OURS, withRc());
    const answer = await availablePlugins({ sdk: '0.15.0-rc.4', urls: [OURS], dir, installed: [], icons: { problem: () => undefined } });
    expect(answer.plugins[0]?.versions.map((one) => one.version)).toEqual(['0.15.0-rc.4', '0.14.0', '0.13.0']);
  });
});

describe('availablePlugins matches an installed plugin', () => {
  it('by its source first, as a first-party plugin whose id the daemon spells otherwise', async () => {
    await keep(OURS, aList());
    const answer = await availablePlugins({ sdk: '0.14.0', urls: [OURS], dir, installed: [{ id: 'ahpd-agent-acp', name: '@ahpd/agent-acp', version: '0.14.0' }], icons: { problem: () => undefined } });
    expect(answer.plugins[0]?.installed).toEqual({ id: 'ahpd-agent-acp', version: '0.14.0' });
  });

  it('by the source installed.json keeps for a github: package', async () => {
    await keep(OURS, aList([aPlugin({ id: 'web', source: 'github:ahpio/ahpw' })]));
    recordInstalled(dir, 'web-ui', { marketplace: OURS, source: 'github:ahpio/ahpw' });
    const answer = await availablePlugins({ sdk: '0.14.0', urls: [OURS], dir, installed: [{ id: 'something-else', name: 'web-ui', version: '0.8.0' }], icons: { problem: () => undefined } });
    expect(answer.plugins[0]?.installed).toEqual({ id: 'something-else', version: '0.8.0', marketplace: OURS });
  });

  it('by its id when no package is its source', async () => {
    await keep(OURS, aList());
    const answer = await availablePlugins({ sdk: '0.14.0', urls: [OURS], dir, installed: [{ id: 'agent-acp', name: './local/acp' }], icons: { problem: () => undefined } });
    expect(answer.plugins[0]?.installed).toEqual({ id: 'agent-acp' });
  });
});

describe('deprecationOf', () => {
  it('answers the message of the version an installed package runs', async () => {
    await keep(OURS, aList([aPlugin({ versions: [aVersion('0.13.0', { deprecated: 'Use 0.14.0.' })] })]));
    expect(deprecationOf('@ahpd/agent-acp', '0.13.0', { urls: [OURS], dir })).toBe('Use 0.14.0.');
    expect(deprecationOf('@ahpd/agent-acp', '0.14.0', { urls: [OURS], dir })).toBeUndefined();
  });
});

describe('listedDetails', () => {
  const files = {
    'https://plugins.example.com/v1/agent-acp/0.14.0/package.json': () => Response.json({
      name: '@ahpd/agent-acp',
      homepage: 'https://example.com/acp',
      ahpd: { contracts: { agents: ['*'] }, links: [{ title: 'Docs', url: 'https://example.com/docs' }] },
    }),
    'https://plugins.example.com/v1/agent-acp/0.14.0/README.md': () => new Response('# Agent ACP'),
  };

  it('answers the README and the contracts of the version that fits, and a second call makes no request', async () => {
    await keep(OURS, aList());
    const { fetch, asked } = stub(files);
    const ask = () => listedDetails({ urls: [OURS], dir, id: 'agent-acp', sdk: '0.15.0', fetch, icons: { problem: () => undefined } });
    const first = await ask();
    expect(first).toMatchObject({
      id: 'agent-acp', marketplace: OURS, version: '0.14.0', versions: ['0.14.0', '0.13.0'],
      readme: '# Agent ACP', contracts: { agents: ['*'] }, homepage: 'https://example.com/acp',
    });
    expect(first.changelog).toBeUndefined();
    expect(first.problems).toBeUndefined();
    const count = asked.length;
    expect(await ask()).toEqual(first);
    expect(asked).toHaveLength(count);
  });

  it('lists no prerelease to a release sdk, and lists it to an sdk that is a prerelease', async () => {
    await keep(OURS, aList([aPlugin({ versions: [aVersion('0.15.0-rc.4'), aVersion('0.14.0'), aVersion('0.13.0')] })]));
    const { fetch } = stub(files);
    const onRelease = await listedDetails({ urls: [OURS], dir, id: 'agent-acp', sdk: '0.14.0', fetch, icons: { problem: () => undefined } });
    expect(onRelease).toMatchObject({ version: '0.14.0', versions: ['0.14.0', '0.13.0'] });
    const onRc = await listedDetails({ urls: [OURS], dir, id: 'agent-acp', sdk: '0.15.0-rc.4', version: '0.14.0', fetch, icons: { problem: () => undefined } });
    expect(onRc.versions).toEqual(['0.15.0-rc.4', '0.14.0', '0.13.0']);
  });

  it('keeps the files of two marketplaces with one id apart', async () => {
    await keep(OURS, aList());
    await keep(THEIRS, aList());
    const { fetch } = stub(files);
    await listedDetails({ urls: [OURS, THEIRS], dir, id: 'agent-acp', sdk: '0.15.0', fetch, icons: { problem: () => undefined } });
    await listedDetails({ urls: [OURS, THEIRS], dir, id: 'agent-acp', marketplace: THEIRS, sdk: '0.15.0', fetch, icons: { problem: () => undefined } });
    expect(readdirSync(pluginFilesPath(dir)).sort()).toEqual([marketplaceName(OURS), marketplaceName(THEIRS)].sort());
  });

  it('answers one problem for a part it could not fetch', async () => {
    await keep(OURS, aList());
    const { fetch } = stub({ 'https://plugins.example.com/v1/agent-acp/0.14.0/package.json': files['https://plugins.example.com/v1/agent-acp/0.14.0/package.json'] });
    const answer = await listedDetails({ urls: [OURS], dir, id: 'agent-acp', sdk: '0.15.0', fetch, icons: { problem: () => undefined } });
    expect(answer.readme).toBeUndefined();
    expect(answer.problems).toEqual([{ part: 'readme', problem: 'https://plugins.example.com/v1/agent-acp/0.14.0/README.md answered 404' }]);
  });

  it('refuses a file that is not https:, and one over 1 MB', async () => {
    await keep(OURS, aList([aPlugin({ versions: [aVersion('0.14.0', { files: { download: 'x', manifest: 'http://plugins.example.com/package.json', readme: 'https://plugins.example.com/big.md' } })] })]));
    const { fetch } = stub({ 'https://plugins.example.com/big.md': () => new Response('x'.repeat(1024 * 1024 + 1)) });
    const answer = await listedDetails({ urls: [OURS], dir, id: 'agent-acp', sdk: '0.15.0', fetch, icons: { problem: () => undefined } });
    expect(answer.problems?.map((one) => one.part).sort()).toEqual(['manifest', 'readme']);
  });

  it('refuses an id no list has, and a version the entry does not list', async () => {
    await keep(OURS, aList());
    const { fetch } = stub({});
    await expect(listedDetails({ urls: [OURS], dir, id: 'agent-pi', sdk: '0.15.0', fetch, icons: { problem: () => undefined } })).rejects.toThrow('agent-pi is in no plugin list.');
    await expect(listedDetails({ urls: [OURS], dir, id: 'agent-acp', version: '9.9.9', sdk: '0.15.0', fetch, icons: { problem: () => undefined } })).rejects.toThrow('agent-acp lists no version 9.9.9.');
  });
});

it('a list file written by hand with another URL is not read for this one', () => {
  writeFileSync(join(dir, 'x.json'), '{}');
  expect(readKept(OURS, dir)).toBeUndefined();
});

describe('installedFiles', () => {
  it('reads the README, changelog and license at a package root in any case, and leaves out a file over 1 MB', () => {
    writeFileSync(join(dir, 'Readme.md'), '# Mine');
    writeFileSync(join(dir, 'CHANGELOG.md'), 'x'.repeat(1024 * 1024 + 1));
    writeFileSync(join(dir, 'LICENSE'), 'MIT');
    expect(installedFiles(dir)).toEqual({ readme: '# Mine', license: 'MIT' });
  });

  it('answers nothing for a folder that is not there', () => {
    expect(installedFiles(join(dir, 'nowhere'))).toEqual({});
  });
});
