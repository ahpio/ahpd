/**
 * Whether a version satisfies a range, read as npm reads it.
 *
 * A plugin declares the `@ahpd/sdk` it was built against as
 * `peerDependencies["@ahpd/sdk"]`, and this is what reads that declaration
 * when npm did not: a plugin named as a path never went through an installer,
 * and one named by an installed package cannot be assumed to have been checked
 * either. A range is written in npm's grammar, so it is read by node-semver,
 * the reader npm itself reads it with
 * (https://github.com/npm/node-semver#ranges): `||` unions, hyphen ranges,
 * x-ranges, `^`, `~` and the comparators, with its own rule for prereleases.
 *
 * A range node-semver cannot read is refused by name rather than passed, so
 * the worst case is a plugin that must be spelled differently and not one that
 * loads unchecked.
 */

import { satisfies as satisfiedBy, valid, validRange } from 'semver';

/**
 * Does `version` satisfy `range`? Throws, naming the range, for one npm could not read.
 *
 * `version` is this daemon's own, so a prerelease of it is read as the release
 * it leads to: a daemon at 0.15.0-rc.1 loads a plugin that asks for >=0.14 <1.
 * node-semver leaves a prerelease out of every range unless told otherwise.
 */
export const satisfies = (version: string, range: string): boolean => {
  if (valid(version) === null) throw new Error(`version ${version} is not one this daemon can read`);
  if (validRange(range) === null) throw new Error(`range ${range} is not one npm can read`);
  return satisfiedBy(version, range, { includePrerelease: true });
};

/** One version a package offers, with the `@ahpd/sdk` range it declares, or none. */
export interface Offered {
  version: string;
  range: string | undefined;
}

/** Why no version of a package can be installed, naming the newest one's range. */
export const noFit = (name: string, newest: { version: string; range: string } | undefined, daemonVersion: string): string =>
  newest === undefined
    ? `${name} has no version that admits @ahpd/sdk ${daemonVersion}.`
    : `${name} has no version that admits @ahpd/sdk ${daemonVersion}: its newest, ${newest.version}, needs ${newest.range}.`;

/** Whether `one` is a later version than `other`, both `X.Y.Z`; a prerelease was left out before this is asked. */
const later = (one: string, other: string): boolean => {
  const a = one.split('.').map(Number);
  const b = other.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
};

/**
 * The newest of `offered` that this daemon can load, refusing when none is.
 *
 * The rule `fittingVersion` reads npm with and the plugin list is read with:
 * no range is a plugin that declares nothing to check, which the loader loads,
 * and a range this daemon cannot read is one it would refuse at the next
 * start. The caller has already left out what it does not offer, such as a
 * prerelease.
 */
export const newestFitting = (name: string, offered: readonly Offered[], daemonVersion: string): string => {
  /** The newest version considered, kept for the refusal, which names its range. */
  let newest: { version: string; range: string } | undefined;
  const fits: string[] = [];
  for (const { version, range } of offered) {
    if (range !== undefined && (newest === undefined || later(version, newest.version))) newest = { version, range };
    if (range === undefined) { fits.push(version); continue; }
    try {
      if (satisfies(daemonVersion, range)) fits.push(version);
    }
    catch { /* refused at the next start, so not installed now */ }
  }
  if (fits.length === 0) throw new Error(noFit(name, newest, daemonVersion));
  return fits.reduce((best, one) => (later(one, best) ? one : best));
};
