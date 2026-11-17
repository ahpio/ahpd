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

/*
 * A person's window settings, the three approval keys, kept in the same file
 * beside their rules: a write of one never loses the other.
 */
it('keeps a person\'s approval settings beside their rules, and nothing else a push carried', () => {
  const at = folder();
  const rules = filePersonRules(at);
  rules.grant('bob', ['Shell(make *)']);
  expect(rules.keep('bob', { terminalAutoApproveRules: { 'make test': true }, editAutoApprovePatterns: { '**/*': true }, defaultShell: '/bin/sh' })).toBe(true);
  expect(rules.settings('bob')).toEqual({ terminalAutoApproveRules: { 'make test': true }, editAutoApprovePatterns: { '**/*': true } });
  expect(rules.read('bob')).toEqual({ allow: ['Shell(make *)'], deny: [] });

  // A grant after them keeps them, and a null takes one back.
  rules.grant('bob', ['Shell(ls *)']);
  expect(rules.keep('bob', { editAutoApprovePatterns: null })).toBe(true);
  expect(rules.settings('bob')).toEqual({ terminalAutoApproveRules: { 'make test': true } });
  expect(rules.read('bob')).toEqual({ allow: ['Shell(make *)', 'Shell(ls *)'], deny: [] });
  expect(readdirSync(at)).toEqual(['bob.json']);
});

it('reads no approval settings for a person with none, and keeps one person\'s from another\'s', () => {
  const rules = filePersonRules(folder());
  expect(rules.settings('alice')).toEqual({});
  rules.keep('bob', { terminalAutoApproveEnabled: false });
  expect(rules.settings('alice')).toEqual({});
  expect(rules.keep('..', { terminalAutoApproveEnabled: false })).toBe(false);
});
