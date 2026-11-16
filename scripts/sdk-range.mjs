import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Whether every first-party plugin declares the `@ahpd/sdk` range of this
 * release, and with `--write`, sets it.
 *
 * A plugin's `peerDependencies["@ahpd/sdk"]` is what the loader and the version
 * pick check against the sdk a daemon ships. Each release sets it from the sdk
 * it ships to the next minor, `>=<sdk> <<major>.<minor + 1>.0-0`: the `-0`
 * keeps the next minor's prereleases out, and the lower bound keeps a release
 * candidate off an older candidate's sdk, which may not have what it imports.
 * The sdk is at 0, where a minor can remove an export, so a plugin from an
 * older minor is refused by its range rather than failing its import.
 *
 * A plugin is a package under `packages/` that is not private and names the
 * sdk in `peerDependencies`. Its file is changed in that one value and nothing
 * else, so a bump's diff is the ranges alone.
 *
 * Run as `node scripts/sdk-range.mjs [--write]`. Without `--write` it prints
 * `<package>: <range>, not <expected>` for each plugin that differs and exits 1.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SDK = '@ahpd/sdk';

/** The range of the release whose sdk is `version`, such as `>=0.15.0-rc.4 <0.16.0-0`. */
export const rangeOf = (version) => {
  const found = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!found) throw new Error(`${SDK} is at ${version}, which is not a version this script reads`);
  return `>=${version} <${found[1]}.${Number(found[2]) + 1}.0-0`;
};

/** Each plugin under `packages/`: its folder, its file's text and the range it declares. */
const plugins = (root) => readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const path = join(root, 'packages', entry.name, 'package.json');
    let text;
    try { text = readFileSync(path, 'utf8'); }
    catch { return []; }
    const manifest = JSON.parse(text);
    const range = manifest.peerDependencies?.[SDK];
    if (manifest.private === true || typeof range !== 'string') return [];
    return [{ name: manifest.name, path, text, range }];
  });

/** The text with the sdk's peer range set to `range`, the rest of it as it was. */
const withRange = (text, range) => {
  const peers = text.indexOf('"peerDependencies"');
  const key = text.indexOf(`"${SDK}"`, peers);
  const value = /("@ahpd\/sdk"\s*:\s*)"[^"]*"/y;
  value.lastIndex = key;
  const found = value.exec(text);
  if (peers === -1 || key === -1 || !found) throw new Error(`no ${SDK} peer range to set`);
  return `${text.slice(0, key)}${found[1]}"${range}"${text.slice(key + found[0].length)}`;
};

const main = () => {
  const sdk = JSON.parse(readFileSync(join(ROOT, 'packages', 'sdk', 'package.json'), 'utf8')).version;
  const expected = rangeOf(sdk);
  const write = process.argv.includes('--write');
  let differ = 0;
  for (const plugin of plugins(ROOT)) {
    if (plugin.range === expected) continue;
    if (write) {
      writeFileSync(plugin.path, withRange(plugin.text, expected));
      console.log(`${plugin.name}: ${plugin.range} -> ${expected}`);
    }
    else {
      console.error(`${plugin.name}: ${plugin.range}, not ${expected}`);
      differ++;
    }
  }
  if (differ > 0) {
    console.error(`Run node scripts/sdk-range.mjs --write to set the range of ${SDK} ${sdk}.`);
    process.exit(1);
  }
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
