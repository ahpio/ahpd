import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bag } from '../types/common.js';
import type { Owner } from '../types/usage.js';
import { withGrant } from '../host/permissions.js';

/**
 * The permission rules each person keeps for their own sessions, a file per
 * person in one folder: `<folder>/<person>.json`, holding a `permissions`
 * value of `allow` and `deny` lists, as a session's and the host's are written.
 */
export interface PersonRules {
  /** One person's `permissions` value, or nothing where they keep none or the file does not read. */
  read(person: string): Bag | undefined;
  /** Adds rules to one person's `allow`, and answers whether anything was written. */
  grant(person: string, rules: readonly string[]): boolean;
}

/** The person an owner is, for a person's own rules: a signed-in user, and nobody else. */
export const personOf = (owner: Owner | undefined): string | undefined =>
  (owner?.startsWith('user:') === true ? owner.slice('user:'.length) : undefined);

/** The file one person's rules are kept in, or nothing for an id that would name a file outside the folder. */
const fileOf = (folder: string, person: string): string | undefined => {
  const name = encodeURIComponent(person);
  return name === '' || name === '.' || name === '..' ? undefined : join(folder, `${name}.json`);
};

/** The person rules kept under `folder`, written with a temporary name and a rename, so a crash leaves the old file whole. */
export const filePersonRules = (folder: string): PersonRules => {
  const read = (person: string): Bag | undefined => {
    const file = fileOf(folder, person);
    if (file === undefined) return undefined;
    try {
      const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
      const permissions = (value as Bag | null)?.permissions;
      return typeof permissions === 'object' && permissions !== null && !Array.isArray(permissions) ? permissions as Bag : undefined;
    }
    catch {
      return undefined;
    }
  };
  return {
    read,
    grant: (person, rules) => {
      const file = fileOf(folder, person);
      if (file === undefined) return false;
      const permissions = withGrant(read(person), rules);
      if (permissions === undefined) return false;
      mkdirSync(folder, { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify({ permissions }, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, file);
      return true;
    },
  };
};
