import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { filePersonRules, personOf } from '../src/access/personrules.js';

/*
 * The rules each person keeps for their own sessions, a file per person: a
 * grant adds to that person's `allow` and keeps what was there, and a person
 * with no file keeps none.
 */

const folders: string[] = [];
const folder = (): string => {
  const made = mkdtempSync(join(tmpdir(), 'ahpd-person-rules-'));
  folders.push(made);
  return join(made, 'permissions');
};
afterEach(() => {
  for (const one of folders.splice(0)) rmSync(one, { recursive: true, force: true });
});

it('adds a grant\'s rules once, and keeps the first grant beside a second', () => {
  const at = folder();
  const rules = filePersonRules(at);
  expect(rules.grant('bob', ['Shell(rm *)'])).toBe(true);
  expect(rules.grant('bob', ['Shell(rm *)'])).toBe(false);
  expect(rules.grant('bob', ['Shell(make *)'])).toBe(true);
  expect(rules.read('bob')).toEqual({ allow: ['Shell(rm *)', 'Shell(make *)'], deny: [] });
  expect(JSON.parse(readFileSync(join(at, 'bob.json'), 'utf8'))).toEqual({ permissions: { allow: ['Shell(rm *)', 'Shell(make *)'], deny: [] } });
  // The temporary file of each write is renamed over the person's file.
  expect(readdirSync(at)).toEqual(['bob.json']);
});

it('reads no rules for a person with no file, and keeps one person\'s rules from another\'s', () => {
  const rules = filePersonRules(folder());
  expect(rules.read('alice')).toBeUndefined();
  rules.grant('bob', ['Shell(rm *)']);
  expect(rules.read('alice')).toBeUndefined();
});

it('writes no file for an id that would name one outside its folder', () => {
  const rules = filePersonRules(folder());
  expect(rules.grant('..', ['Shell(rm *)'])).toBe(false);
  expect(rules.grant('a/../../b', ['Shell(rm *)'])).toBe(true);
  expect(rules.read('a/../../b')).toEqual({ allow: ['Shell(rm *)'], deny: [] });
});

it('names a person only for a signed-in user', () => {
  expect(personOf('user:bob')).toBe('bob');
  expect(personOf('root:host')).toBeUndefined();
  expect(personOf('team:ops')).toBeUndefined();
  expect(personOf(undefined)).toBeUndefined();
});
