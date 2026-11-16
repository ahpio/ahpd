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

import { gt, prerelease, satisfies as satisfiedBy, valid, validRange } from 'semver';

/**
 * Does `version` satisfy `range`? Throws, naming the range, for one npm could not read.
 *
 * `version` is the sdk the daemon ships, and a prerelease of it is compared as
 * any other version: an sdk at 0.15.0-rc.1 satisfies >=0.14 <1 and
 * >=0.15.0-rc.1 <0.16.0-0, and not >=0.15.0-rc.2 <0.16.0-0. node-semver leaves a
 * prerelease out of every range unless told otherwise.
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
export const noFit = (name: string, newest: { version: string; range: string } | undefined, sdk: string): string =>
  newest === undefined
    ? `${name} has no version that admits @ahpd/sdk ${sdk}.`
    : `${name} has no version that admits @ahpd/sdk ${sdk}: its newest, ${newest.version}, needs ${newest.range}.`;

/**
 * Whether a daemon whose sdk is `sdk` considers `version` of a plugin at all.
 *
 * A release is considered by every daemon. A prerelease is considered only
 * when the sdk is one too, so a daemon on a release candidate finds the
 * plugins of its own release and a daemon on a release never installs a
 * prerelease nobody named. Which prerelease fits is the plugin's range to say,
 * checked by `newestFitting`. A version that is not semver is not considered.
 */
export const isOffered = (version: string, sdk: string): boolean => {
  if (valid(version) === null) return false;
  if (prerelease(version) === null) return true;
  return valid(sdk) !== null && prerelease(sdk) !== null;
};

/** Whether `one` is a later version than `other`, in semver order: `0.15.0` is later than `0.15.0-rc.4`. */
const later = (one: string, other: string): boolean => gt(one, other);

/**
 * The newest of `offered` that this daemon can load, refusing when none is.
 *
 * The rule `fittingVersion` reads npm with and the plugin list is read with:
 * no range is a plugin that declares nothing to check, which the loader loads,
 * and a range this daemon cannot read is one it would refuse at the next
 * start. The caller has already left out what `isOffered` does not admit.
 */
export const newestFitting = (name: string, offered: readonly Offered[], sdk: string): string => {
  /** The newest version considered, kept for the refusal, which names its range. */
  let newest: { version: string; range: string } | undefined;
  const fits: string[] = [];
  for (const { version, range } of offered) {
    if (range !== undefined && (newest === undefined || later(version, newest.version))) newest = { version, range };
    if (range === undefined) { fits.push(version); continue; }
    try {
      if (satisfies(sdk, range)) fits.push(version);
    }
    catch { /* refused at the next start, so not installed now */ }
  }
  if (fits.length === 0) throw new Error(noFit(name, newest, sdk));
  return fits.reduce((best, one) => (later(one, best) ? one : best));
};
