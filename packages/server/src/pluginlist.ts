/**
 * The plugin lists the daemon reads, kept on disk, and what is read from them.
 *
 * A marketplace is a URL that serves a plugin list in the format of
 * `https://plugins.ahpio.com/v1/plugins.json`: every listed plugin, each with
 * every version and the URLs of that version's files. `pluginMarketplaces`
 * names them in order, as VS Code's `chat.plugins.marketplaces` does. The
 * daemon fetches each one in the background and keeps it in
 * `plugin-marketplaces/`, one file for each URL; everything else here reads
 * those files and never the network, so a listing, an install and a client's
 * page answer from what was fetched last.
 *
 * Every entry of every list is kept, two with the same id included, and each
 * names the marketplace it came from, as VS Code keeps `plugin@marketplace`
 * (src/vs/workbench/contrib/chat/common/plugins/pluginMarketplaceService.ts
 * L679 at 1564f100807a). The marketplace each installed plugin came from is in
 * `installed.json` beside the lists, as VS Code keeps its own `installed.json`
 * (fileBackedInstalledPluginsStore.ts L33-L50 at 1564f100807a).
 *
 * A file a client reads, such as a README or an icon, is fetched by the daemon
 * once and kept under `plugin-files/`, so a client never contacts the host a
 * list names.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isRecord, readJsonObject, writeJsonAtomic } from '@ahpd/sdk';
import type { Icon } from '@ahpd/sdk';
import { newestFitting } from './compat.js';
import { loadConfig, pluginFilesPath, pluginMarketplacesPath } from './config.js';
import { fetchIcons, ICON_BOUNDS } from './icons.js';
import type { IconBounds, IconProblem } from './icons.js';
import { parse } from './update.js';
import type { Fetch } from './update.js';

/** The marketplaces a daemon reads when its configuration names none. */
export const DEFAULT_MARKETPLACES: readonly string[] = ['https://plugins.ahpio.com/v1/plugins.json'];

/** How many hours a fetched list is kept before it is fetched again, when the configuration says nothing. */
export const DEFAULT_CHECK_HOURS = 12;

/** The list format this daemon reads; a list of another format is left as it was. */
export const LIST_FORMAT = 1;

/** The most a list may be, in bytes; a larger body is not kept. */
export const LIST_LIMIT = 5 * 1024 * 1024;

/** How long one fetch of a list may take, as `askRegistry` waits for npm. */
export const LIST_TIMEOUT_MS = 5000;

/** The most one file of a listed version may be, in bytes. */
export const FILE_LIMIT = 1024 * 1024;

/** How long one fetch of a listed version's file may take. */
export const FILE_TIMEOUT_MS = 10_000;

/** One icon as a list names it: an `https:` `src`, with the members of an `ahpd.icons` entry. */
export interface ListedIcon {
  src: string;
  theme?: 'light' | 'dark';
  contentType?: string;
  sizes?: string[];
}

/** The URLs of one version's files: what an install fetches, and what a details page shows. */
export interface ListedFiles {
  /** npm's `dist.tarball`, or the repository archive at the version's commit. */
  download: string;
  /** The version's `package.json`. */
  manifest: string;
  readme?: string;
  changelog?: string;
  license?: string;
  icons?: ListedIcon[];
}

/** One version of a listed plugin. */
export interface ListedVersion {
  version: string;
  /** The version's `peerDependencies["@ahpd/sdk"]`; absent is a version that loads on every daemon. */
  sdk?: string;
  /** npm's `dist.integrity`, for an npm source. */
  integrity?: string;
  /** The commit of the version's tag, for a `github:` source. */
  commit?: string;
  /** When the version was published. */
  published?: string;
  /** npm's deprecation message: a version that has one is never installed or updated to. */
  deprecated?: string;
  files: ListedFiles;
}

/** One listed plugin, as the list serves it. */
export interface ListedPlugin {
  /** The id the plugin names itself with. */
  id: string;
  name?: string;
  description?: string;
  /** What an install sends: an npm name, or `github:<owner>/<repo>`. */
  source: string;
  categories?: string[];
  author?: string;
  license?: string;
  repository?: string;
  icons?: ListedIcon[];
  /** Every listed version, newest first. */
  versions: ListedVersion[];
}

/** A whole list, as its URL serves it. */
export interface PluginList {
  version: number;
  plugins: ListedPlugin[];
}

/** What one marketplace's file holds: the list, and what the next fetch sends. */
export interface KeptList {
  url: string;
  etag?: string;
  checkedAt: string;
  list: PluginList;
}

/** One marketplace as a client reads it: `on` with its plugins, or `missing` until its first fetch. */
export interface Marketplace {
  url: string;
  state: 'on' | 'missing';
  checkedAt?: string;
  plugins: ListedPlugin[];
}

/** One listed plugin, with the marketplace it came from. */
export interface Listing {
  marketplace: string;
  plugin: ListedPlugin;
}

/** One entry of `installed.json`: the marketplace an installed package came from, and the source it was listed as. */
export interface InstalledFrom {
  marketplace: string;
  source: string;
}

/** Where the plugin lists are read from: the configured URLs, and the configuration folder. */
export interface ListsAt {
  urls: readonly string[];
  dir: string;
}

/** The first 16 hex digits of a text's SHA-256, which names the files kept for it. */
const hashOf = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** The name of a marketplace's file, without `.json`, which also names the folder its version files are kept in. */
export const marketplaceName = (url: string): string => hashOf(url);

/** The file one marketplace's list is kept in. */
const listFile = (dir: string, url: string): string => join(pluginMarketplacesPath(dir), `${marketplaceName(url)}.json`);

/** The file that names the marketplace each installed package came from. */
const INSTALLED = 'installed.json';

/** The marketplaces a configuration names, or the default when it names none. */
export const marketplacesOf = (values: { pluginMarketplaces?: unknown }): string[] =>
  Array.isArray(values.pluginMarketplaces)
    ? values.pluginMarketplaces.filter((one): one is string => typeof one === 'string')
    : [...DEFAULT_MARKETPLACES];

/**
 * The marketplaces the configuration file names, read where no daemon handed
 * them in: at the terminal, and in the self-update. A file that cannot be read
 * names the default, as a missing key does.
 */
export const configuredMarketplaces = (configFile?: string): string[] => {
  try {
    return marketplacesOf(loadConfig(configFile).values);
  }
  catch {
    return [...DEFAULT_MARKETPLACES];
  }
};

/** Whether a value is a list of icons as a list names them, each with a string `src`. */
const iconsIn = (value: unknown): ListedIcon[] | undefined =>
  Array.isArray(value) ? value.filter((one): one is ListedIcon => isRecord(one) && typeof one.src === 'string') : undefined;

/** One version as a list holds it, or nothing when it is not one this daemon can read. */
const versionIn = (value: unknown): ListedVersion | undefined => {
  if (!isRecord(value) || typeof value.version !== 'string' || !isRecord(value.files)) return undefined;
  const files = value.files;
  if (typeof files.download !== 'string' || typeof files.manifest !== 'string') return undefined;
  const text = (key: string): string | undefined => (typeof value[key] === 'string' ? value[key] : undefined);
  const file = (key: string): string | undefined => (typeof files[key] === 'string' ? files[key] : undefined);
  const icons = iconsIn(files.icons);
  const sdk = text('sdk');
  const integrity = text('integrity');
  const commit = text('commit');
  const published = text('published');
  const deprecated = text('deprecated');
  const readme = file('readme');
  const changelog = file('changelog');
  const license = file('license');
  return {
    version: value.version,
    ...(sdk === undefined ? {} : { sdk }),
    ...(integrity === undefined ? {} : { integrity }),
    ...(commit === undefined ? {} : { commit }),
    ...(published === undefined ? {} : { published }),
    // npm writes an empty string for a deprecation it took back.
    ...(deprecated === undefined || deprecated === '' ? {} : { deprecated }),
    files: {
      download: files.download,
      manifest: files.manifest,
      ...(readme === undefined ? {} : { readme }),
      ...(changelog === undefined ? {} : { changelog }),
      ...(license === undefined ? {} : { license }),
      ...(icons === undefined ? {} : { icons }),
    },
  };
};

/** One plugin as a list holds it, or nothing when it has no id, source or versions this daemon can read. */
const pluginIn = (value: unknown): ListedPlugin | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.source !== 'string' || !Array.isArray(value.versions)) return undefined;
  const versions = value.versions.map(versionIn).filter((one): one is ListedVersion => one !== undefined);
  const text = (key: string): string | undefined => (typeof value[key] === 'string' ? value[key] : undefined);
  const categories = Array.isArray(value.categories) ? value.categories.filter((one): one is string => typeof one === 'string') : undefined;
  const icons = iconsIn(value.icons);
  const name = text('name');
  const description = text('description');
  const author = text('author');
  const license = text('license');
  const repository = text('repository');
  return {
    id: value.id,
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
    source: value.source,
    ...(categories === undefined ? {} : { categories }),
    ...(author === undefined ? {} : { author }),
    ...(license === undefined ? {} : { license }),
    ...(repository === undefined ? {} : { repository }),
    ...(icons === undefined ? {} : { icons }),
    versions,
  };
};

/** Whether a parsed body is a list of the format this daemon reads. */
const isList = (value: unknown): value is PluginList =>
  isRecord(value) && value.version === LIST_FORMAT && Array.isArray(value.plugins);

/** What a marketplace's file holds, or nothing: a missing, broken or misshapen file is the same answer. */
export const readKept = (url: string, dir: string): KeptList | undefined => {
  const read = readJsonObject(listFile(dir, url));
  if (!read.ok) return undefined;
  const held = read.value;
  if (held.url !== url || typeof held.checkedAt !== 'string' || !isList(held.list)) return undefined;
  return {
    url,
    ...(typeof held.etag === 'string' ? { etag: held.etag } : {}),
    checkedAt: held.checkedAt,
    list: held.list,
  };
};

/** Is a marketplace's file older than `maxAgeMs`? No file and an unreadable date are old. */
export const staleList = (url: string, dir: string, maxAgeMs: number, now = Date.now()): boolean => {
  const kept = readKept(url, dir);
  if (kept === undefined) return true;
  const at = Date.parse(kept.checkedAt);
  return Number.isNaN(at) || now - at > maxAgeMs;
};

/** A body read up to `limit` bytes, or nothing when it is larger. */
const readCapped = async (answer: Response, limit: number): Promise<string | undefined> => {
  const length = Number(answer.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) return undefined;
  if (answer.body === null) return '';
  const reader = answer.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

/** What a fetch of a list did: wrote a new list, kept the one there, or failed and left the file as it was. */
export type Refreshed = 'written' | 'kept' | 'failed';

/** What fetching a list was given. */
export interface RefreshOptions {
  url: string;
  /** The daemon's version, which `User-Agent` names. */
  version: string;
  /** The configuration folder the list's file is in. */
  dir: string;
  fetch?: Fetch | undefined;
  timeoutMs?: number;
  /** Where a failure is said, one line at debug level. */
  log?: (line: string) => void;
}

/**
 * Fetch one list, and keep it.
 *
 * `If-None-Match` sends the `ETag` of the list there, so an unchanged list is a
 * 304 and only `checkedAt` is written. A 200 is kept when it is JSON of format
 * 1 with a `plugins` array. Every failure leaves the file as it was and is
 * said in one line: offline, a timeout, an answer that is not `ok`, a body
 * over the limit, one that is not JSON, and a list of another format.
 */
export async function refreshMarketplace(options: RefreshOptions): Promise<Refreshed> {
  const { url, dir } = options;
  const failed = (why: string): Refreshed => {
    options.log?.(`plugin list ${url}: ${why}; the list kept is used`);
    return 'failed';
  };
  const kept = readKept(url, dir);
  let answer: Response;
  try {
    answer = await (options.fetch ?? fetch)(url, {
      headers: {
        accept: 'application/json',
        'user-agent': `ahpd/${options.version}`,
        ...(kept?.etag === undefined ? {} : { 'if-none-match': kept.etag }),
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? LIST_TIMEOUT_MS),
    });
  }
  catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }
  const checkedAt = new Date().toISOString();
  if (answer.status === 304 && kept !== undefined) {
    writeJsonAtomic(listFile(dir, url), { ...kept, checkedAt }, { mode: 0o644 });
    return 'kept';
  }
  if (!answer.ok) return failed(`answered ${String(answer.status)}`);
  let text: string | undefined;
  try {
    text = await readCapped(answer, LIST_LIMIT);
  }
  catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }
  if (text === undefined) return failed(`larger than ${String(LIST_LIMIT)} bytes`);
  let body: unknown;
  try {
    body = JSON.parse(text);
  }
  catch {
    return failed('not JSON');
  }
  if (!isList(body)) {
    return failed(isRecord(body) && body.version !== LIST_FORMAT ? `format ${String(body.version)}, not ${String(LIST_FORMAT)}` : 'not a plugin list');
  }
  const etag = answer.headers.get('etag');
  writeJsonAtomic(listFile(dir, url), { url, ...(etag === null ? {} : { etag }), checkedAt, list: body }, { mode: 0o644 });
  return 'written';
}

/** What fetching every list was given. */
export interface RefreshAllOptions extends ListsAt {
  version: string;
  /** How old a list may be before it is fetched again. */
  maxAgeMs: number;
  fetch?: Fetch | undefined;
  log?: (line: string) => void;
}

/**
 * Fetch each list older than `maxAgeMs`, and remove the file of a list the
 * configuration no longer names. Answers whether a new list was written.
 */
export async function refreshMarketplaces(options: RefreshAllOptions): Promise<boolean> {
  const folder = pluginMarketplacesPath(options.dir);
  const named = new Set(options.urls.map((url) => `${marketplaceName(url)}.json`));
  if (existsSync(folder)) {
    for (const file of readdirSync(folder)) {
      if (file !== INSTALLED && file.endsWith('.json') && !named.has(file)) rmSync(join(folder, file), { force: true });
    }
  }
  const stale = options.urls.filter((url) => staleList(url, options.dir, options.maxAgeMs));
  const done = await Promise.all(stale.map((url) => refreshMarketplace({
    url,
    version: options.version,
    dir: options.dir,
    fetch: options.fetch,
    ...(options.log === undefined ? {} : { log: options.log }),
  })));
  return done.includes('written');
}

/** Each list in `urls` order, `on` with its plugins or `missing` until it is first fetched. */
export const readMarketplaces = (at: ListsAt): Marketplace[] => at.urls.map((url) => {
  const kept = readKept(url, at.dir);
  if (kept === undefined) return { url, state: 'missing', plugins: [] };
  return {
    url,
    state: 'on',
    checkedAt: kept.checkedAt,
    plugins: kept.list.plugins.map(pluginIn).filter((one): one is ListedPlugin => one !== undefined),
  };
});

/** Every entry of every list, in `urls` order, two with the same id included, each with its marketplace. */
export const listedEntries = (at: ListsAt): Listing[] =>
  readMarketplaces(at).flatMap((one) => one.plugins.map((plugin) => ({ marketplace: one.url, plugin })));

/** What `installed.json` holds: the marketplace each installed package came from. */
export const readInstalled = (dir: string): Record<string, InstalledFrom> => {
  const read = readJsonObject(join(pluginMarketplacesPath(dir), INSTALLED));
  if (!read.ok) return {};
  const out: Record<string, InstalledFrom> = {};
  for (const [name, held] of Object.entries(read.value)) {
    if (isRecord(held) && typeof held.marketplace === 'string' && typeof held.source === 'string') {
      out[name] = { marketplace: held.marketplace, source: held.source };
    }
  }
  return out;
};

/** The marketplace one installed package came from, or nothing when it came from none. */
export const installedRecord = (dir: string, name: string): InstalledFrom | undefined => readInstalled(dir)[name];

/** Keep the marketplace an installed package came from. */
export const recordInstalled = (dir: string, name: string, from: InstalledFrom): void => {
  writeJsonAtomic(join(pluginMarketplacesPath(dir), INSTALLED), { ...readInstalled(dir), [name]: from }, { mode: 0o644 });
};

/** Forget the marketplace of each package removed. */
export const forgetInstalled = (dir: string, names: readonly string[]): void => {
  const held = readInstalled(dir);
  if (!names.some((name) => Object.hasOwn(held, name))) return;
  for (const name of names) delete held[name];
  writeJsonAtomic(join(pluginMarketplacesPath(dir), INSTALLED), held, { mode: 0o644 });
};

/** The entry one marketplace lists for a source, or nothing. */
const entryIn = (at: ListsAt, marketplace: string, source: string): Listing | undefined =>
  listedEntries(at).find((one) => one.marketplace === marketplace && one.plugin.source === source);

/**
 * The listed plugin a source installs from.
 *
 * The named marketplace, which `urls` must name and which must list the
 * source. With none named: the marketplace `installed.json` names for that
 * source, then the first marketplace in `urls` that lists it, an npm name and a
 * `github:` source alike. Nothing when no marketplace lists the source, which
 * then installs as it does with no list.
 */
export const listedVersions = (source: string, at: ListsAt & { marketplace?: string | undefined }): Listing | undefined => {
  if (at.marketplace !== undefined) {
    if (!at.urls.includes(at.marketplace)) throw new Error(`${at.marketplace} is not in pluginMarketplaces.`);
    const named = entryIn(at, at.marketplace, source);
    if (named === undefined) throw new Error(`${at.marketplace} does not list ${source}.`);
    return named;
  }
  const kept = Object.values(readInstalled(at.dir)).find((one) => one.source === source);
  if (kept !== undefined && at.urls.includes(kept.marketplace)) {
    const from = entryIn(at, kept.marketplace, source);
    if (from !== undefined) return from;
  }
  return listedEntries(at).find((one) => one.plugin.source === source);
};

/**
 * The listed plugin an installed package was installed from: the marketplace
 * `installed.json` names for it, or the first marketplace that lists it by its
 * name.
 */
export const installedListing = (name: string, at: ListsAt): Listing | undefined => {
  const kept = installedRecord(at.dir, name);
  if (kept !== undefined && at.urls.includes(kept.marketplace)) {
    const from = entryIn(at, kept.marketplace, kept.source);
    if (from !== undefined) return from;
  }
  return listedEntries(at).find((one) => one.plugin.source === name);
};

/**
 * The newest listed version this daemon can load, refusing when none is.
 *
 * A prerelease is skipped, as the npm path skips one, and so is a version the
 * list marks `deprecated`. Nothing when the daemon's version is `unknown`,
 * which no range can be compared against.
 */
export const fittingListed = (name: string, versions: readonly ListedVersion[], daemonVersion: string): ListedVersion | undefined => {
  if (daemonVersion === 'unknown') return undefined;
  const offered = versions
    .filter((one) => { const read = parse(one.version); return read !== undefined && !read.prerelease && one.deprecated === undefined; })
    .map((one) => ({ version: one.version, range: one.sdk }));
  const chosen = newestFitting(name, offered, daemonVersion);
  return versions.find((one) => one.version === chosen);
};

/** A path segment a list may name: an id or a version, never a folder above. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/u;

/** Fetch one file of at most `limit` bytes over `https:`, or say why not. */
const fetchFile = async (url: string, fetcher: Fetch, limit: number): Promise<{ text: string } | { problem: string }> => {
  if (!/^https:/iu.test(url)) return { problem: `${url} is not an https: URL` };
  let answer: Response;
  try {
    answer = await fetcher(url, { signal: AbortSignal.timeout(FILE_TIMEOUT_MS) });
  }
  catch (error) {
    return { problem: `${url}: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!answer.ok) return { problem: `${url} answered ${String(answer.status)}` };
  const text = await readCapped(answer, limit).catch(() => undefined);
  if (text === undefined) return { problem: `${url} is larger than ${String(limit)} bytes` };
  return { text };
};

/** What turning a list's icons into what a client draws was given. */
export interface IconOptions {
  dir: string;
  /** Who the icons are for, in the line a dropped icon is said with. */
  by: string;
  problem: IconProblem;
  fetch?: typeof fetch | undefined;
  bounds?: IconBounds | undefined;
}

/**
 * A list's icons as `data:` URIs, each fetched once and kept under
 * `plugin-files/icons/`, named by its URL's hash. An icon that cannot be
 * fetched is dropped with one line, as an installed plugin's is, and is asked
 * for again the next time.
 */
export async function listedIcons(icons: readonly ListedIcon[], options: IconOptions): Promise<Icon[]> {
  const folder = join(pluginFilesPath(options.dir), 'icons');
  const out = await Promise.all(icons.map(async (icon): Promise<Icon | undefined> => {
    const file = join(folder, `${hashOf(icon.src)}.json`);
    const held = readJsonObject(file);
    if (held.ok && typeof held.value.src === 'string' && held.value.src.startsWith('data:')) return held.value as unknown as Icon;
    const [drawn] = await fetchIcons([icon as Icon], options.by, options.problem, options.fetch ?? fetch, options.bounds ?? ICON_BOUNDS);
    if (drawn === undefined || !drawn.src.startsWith('data:')) return undefined;
    try {
      writeJsonAtomic(file, drawn, { mode: 0o644 });
    }
    catch { /* kept in memory only: the next call fetches it again */ }
    return drawn;
  }));
  return out.filter((icon): icon is Icon => icon !== undefined);
}

/** What one installed plugin is, as `available` matches it with a listed id. */
export interface InstalledRow {
  /** The id the daemon lists it under. */
  id: string;
  /** The package or spec its entry names, which `installed.json` is keyed by. */
  name: string;
  version?: string;
}

/** One listed plugin as `available` answers it. */
export interface AvailableEntry extends Omit<ListedPlugin, 'icons'> {
  marketplace: string;
  icons?: Icon[];
  /** The installed plugin this entry is: its row id, its version, the marketplace it came from, and the deprecation of its version. */
  installed?: { id: string; version?: string; marketplace?: string; deprecated?: string };
}

/** What `available` answers. */
export interface Available {
  marketplaces: { url: string; state: 'on' | 'missing'; checkedAt?: string }[];
  plugins: AvailableEntry[];
}

/** What `available` was given. */
export interface AvailableOptions extends ListsAt {
  installed: readonly InstalledRow[];
  icons: Omit<IconOptions, 'dir' | 'by'>;
}

/**
 * Every listed plugin, with its marketplace, its icons as `data:` URIs and the
 * installed plugin it is: the one whose package is its source, or else the one
 * with its id.
 */
export async function availablePlugins(options: AvailableOptions): Promise<Available> {
  const marketplaces = readMarketplaces(options);
  const installed = readInstalled(options.dir);
  const plugins = await Promise.all(marketplaces.flatMap((one) => one.plugins.map(async (plugin): Promise<AvailableEntry> => {
    const { icons, ...rest } = plugin;
    const drawn = icons === undefined ? undefined : await listedIcons(icons, { ...options.icons, dir: options.dir, by: plugin.id });
    // By source first: a list's id need not be the one the daemon gives the
    // package, as a first-party plugin with no `name` export shows, where the
    // list says `agent-acp` and the daemon `ahpd-agent-acp`. A `github:`
    // source is matched through the source `installed.json` kept for it.
    const row = options.installed.find((held) => held.name === plugin.source || installed[held.name]?.source === plugin.source)
      ?? options.installed.find((held) => held.id === plugin.id);
    const from = row === undefined ? undefined : installed[row.name]?.marketplace;
    const deprecated = row?.version === undefined ? undefined : plugin.versions.find((version) => version.version === row.version)?.deprecated;
    return {
      ...rest,
      marketplace: one.url,
      ...(drawn === undefined ? {} : { icons: drawn }),
      ...(row === undefined ? {} : {
        installed: {
          id: row.id,
          ...(row.version === undefined ? {} : { version: row.version }),
          ...(from === undefined ? {} : { marketplace: from }),
          ...(deprecated === undefined ? {} : { deprecated }),
        },
      }),
    };
  })));
  return {
    marketplaces: marketplaces.map(({ url, state, checkedAt }) => ({ url, state, ...(checkedAt === undefined ? {} : { checkedAt }) })),
    plugins,
  };
}

/** The deprecation message of an installed package's version, read from the list it was installed from, or nothing. */
export const deprecationOf = (name: string, version: string | undefined, at: ListsAt): string | undefined => {
  if (version === undefined) return undefined;
  return installedListing(name, at)?.plugin.versions.find((one) => one.version === version)?.deprecated;
};

/** One part of a details page that could not be fetched, and why. */
export interface DetailsProblem {
  part: string;
  problem: string;
}

/** What a details page shows for one listed version, before an install. */
export interface Details {
  id: string;
  marketplace: string;
  version: string;
  /** Every listed version, newest first. */
  versions: string[];
  readme?: string;
  changelog?: string;
  license?: string;
  contracts?: unknown;
  links?: unknown;
  optionsSchema?: unknown;
  homepage?: unknown;
  bugs?: unknown;
  repository?: unknown;
  icons?: Icon[];
  problems?: DetailsProblem[];
}

/** What reading a details page was given. */
export interface DetailsOptions extends ListsAt {
  id: string;
  marketplace?: string | undefined;
  version?: string | undefined;
  /** The daemon's own version, which picks the version when none is named. */
  daemonVersion: string;
  fetch?: Fetch | undefined;
  icons: Omit<IconOptions, 'dir' | 'by'>;
}

/** The parts of a version a details page fetches, by the name its file is kept under. */
const PARTS = ['manifest', 'readme', 'changelog', 'license'] as const;

/**
 * What a details page shows for one listed plugin.
 *
 * The entry is the named marketplace's, or the first marketplace's that lists
 * the id. The version is the one named, or the newest that fits this daemon.
 * Each file of `files` is fetched once and kept at
 * `plugin-files/<marketplace>/<id>/<version>/<name>`, where `<marketplace>` is
 * the name of that marketplace's list file, and read from there the next time:
 * a version's files never change. A part that cannot be fetched is one
 * `problem`, and the rest are still answered.
 */
export async function listedDetails(options: DetailsOptions): Promise<Details> {
  if (options.marketplace !== undefined && !options.urls.includes(options.marketplace)) {
    throw new Error(`${options.marketplace} is not in pluginMarketplaces.`);
  }
  const entry = listedEntries(options).find((one) => one.plugin.id === options.id && (options.marketplace === undefined || one.marketplace === options.marketplace));
  if (entry === undefined) {
    throw new Error(options.marketplace === undefined ? `${options.id} is in no plugin list.` : `${options.marketplace} does not list ${options.id}.`);
  }
  const { plugin, marketplace } = entry;
  const named = options.version === undefined ? undefined : plugin.versions.find((one) => one.version === options.version);
  if (options.version !== undefined && named === undefined) throw new Error(`${options.id} lists no version ${options.version}.`);
  const version = named
    ?? fittingListed(options.id, plugin.versions, options.daemonVersion)
    ?? plugin.versions.find((one) => { const read = parse(one.version); return read !== undefined && !read.prerelease; });
  if (version === undefined) throw new Error(`${options.id} lists no version.`);
  if (!SEGMENT.test(plugin.id) || !SEGMENT.test(version.version)) throw new Error(`${options.id} ${version.version} is not a name a file can be kept under.`);
  const folder = join(pluginFilesPath(options.dir), marketplaceName(marketplace), plugin.id, version.version);
  const problems: DetailsProblem[] = [];
  const texts: Partial<Record<typeof PARTS[number], string>> = {};
  await Promise.all(PARTS.map(async (part) => {
    const url = version.files[part];
    if (url === undefined) return;
    const file = join(folder, part);
    if (existsSync(file)) {
      texts[part] = readFileSync(file, 'utf8');
      return;
    }
    const fetched = await fetchFile(url, options.fetch ?? fetch, FILE_LIMIT);
    if ('problem' in fetched) {
      problems.push({ part, problem: fetched.problem });
      return;
    }
    texts[part] = fetched.text;
    try {
      writeTextAtomic(file, fetched.text);
    }
    catch { /* answered now, and fetched again the next time */ }
  }));
  let manifest: Record<string, unknown> = {};
  if (texts.manifest !== undefined) {
    try {
      const parsed: unknown = JSON.parse(texts.manifest);
      if (isRecord(parsed)) manifest = parsed;
      else problems.push({ part: 'manifest', problem: 'the manifest is not an object' });
    }
    catch {
      problems.push({ part: 'manifest', problem: 'the manifest is not JSON' });
    }
  }
  const ahpd = isRecord(manifest.ahpd) ? manifest.ahpd : {};
  const icons = version.files.icons === undefined
    ? undefined
    : await listedIcons(version.files.icons, { ...options.icons, dir: options.dir, by: plugin.id });
  const details: Details = {
    id: plugin.id,
    marketplace,
    version: version.version,
    versions: plugin.versions.map((one) => one.version),
    ...(texts.readme === undefined ? {} : { readme: texts.readme }),
    ...(texts.changelog === undefined ? {} : { changelog: texts.changelog }),
    ...(texts.license === undefined ? {} : { license: texts.license }),
    ...(icons === undefined || icons.length === 0 ? {} : { icons }),
    ...(problems.length === 0 ? {} : { problems }),
  };
  // What the manifest declares, each where the package has it.
  for (const key of ['contracts', 'links', 'optionsSchema'] as const) {
    if (ahpd[key] !== undefined) details[key] = ahpd[key];
  }
  for (const key of ['homepage', 'bugs', 'repository'] as const) {
    if (manifest[key] !== undefined) details[key] = manifest[key];
  }
  return details;
}

/** The files an installed package has for a person to read, each at most `FILE_LIMIT`. */
export interface InstalledFiles {
  readme?: string;
  changelog?: string;
  license?: string;
}

/** The name of each file `installedFiles` reads, as a package's root names it in any case. */
const READ_FILES: readonly (readonly [keyof InstalledFiles, RegExp])[] = [
  ['readme', /^readme(?:\.md|\.markdown|\.txt)?$/iu],
  ['changelog', /^(?:changelog|changes|history)(?:\.md|\.markdown|\.txt)?$/iu],
  ['license', /^licen[sc]e(?:\.md|\.txt)?$/iu],
];

/**
 * The README, changelog and license an installed package holds at its root,
 * read from disk: an installed plugin's page shows what is installed, from a
 * list or from a folder, and not what a list says of another build. A file
 * over `FILE_LIMIT` is left out.
 */
export function installedFiles(packageDir: string): InstalledFiles {
  let names: string[];
  try {
    names = readdirSync(packageDir);
  }
  catch {
    return {};
  }
  const out: InstalledFiles = {};
  for (const [part, pattern] of READ_FILES) {
    const name = names.find((one) => pattern.test(one));
    if (name === undefined) continue;
    try {
      const text = readFileSync(join(packageDir, name));
      if (text.byteLength <= FILE_LIMIT) out[part] = text.toString('utf8');
    }
    catch { /* a file that cannot be read is one the page does not show */ }
  }
  return out;
}

/** Write a text file beside its place and rename it over, as `writeJsonAtomic` writes JSON, so a half file is never read. */
const writeTextAtomic = (file: string, text: string): void => {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${String(process.pid)}.tmp`;
  writeFileSync(temporary, text, { mode: 0o644 });
  renameSync(temporary, file);
};
