import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

/*
 * Every test removes its temp folder in a teardown with `clearFolder`, which
 * ends the folder's holders and retries the removal. A bare
 * `rmSync(..., { recursive })` in an `afterEach`, an `afterAll` or a `finally`
 * block is refused with its file and line. A removal in the middle of a case
 * stays as it is, since a process the case still uses may name the folder.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** Every test file under each package's `test` folder. */
const testFiles = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string, inTest: boolean): void => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, inTest || name === 'test');
      else if (inTest && name.endsWith('.ts')) out.push(path);
    }
  };
  walk(join(ROOT, 'packages'), false);
  return out;
};

/** The statement text that opens the block at `brace`. */
const openerText = (src: string, brace: number): string => {
  let i = brace - 1;
  let depth = 0;
  for (; i >= 0; i -= 1) {
    const c = src[i];
    if (c === ')') depth += 1;
    else if (c === '(') {
      if (depth === 0) break;
      depth -= 1;
    }
    else if (depth === 0 && (c === ';' || c === '{' || c === '}')) break;
  }
  return src.slice(i + 1, brace).trim();
};

/** Whether `pos` is inside an `afterEach`, an `afterAll` or a `finally` block. */
const inTeardown = (src: string, pos: number): boolean => {
  let curly = 0;
  let paren = 0;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const c = src[i];
    if (c === '}') curly += 1;
    else if (c === ')') paren += 1;
    else if (c === '{') {
      if (curly > 0) curly -= 1;
      else {
        const text = openerText(src, i);
        if (/(^|\W)finally$/u.test(text) || /after(Each|All)\s*\(/u.test(text)) return true;
      }
    }
    else if (c === '(') {
      if (paren > 0) paren -= 1;
      else if (/after(Each|All)\s*$/u.test(src.slice(Math.max(0, i - 20), i))) return true;
    }
  }
  return false;
};

/** The text of the call that starts at `start`, up to its closing parenthesis. */
const callAt = (src: string, start: number): string => {
  let depth = 0;
  for (let i = start + 'rmSync'.length; i < src.length; i += 1) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
};

it('removes every temp folder in a teardown with clearFolder', () => {
  const bare: string[] = [];
  for (const file of testFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(/\brmSync\(/gu)) {
      const at = match.index;
      if (!callAt(src, at).includes('recursive') || !inTeardown(src, at)) continue;
      bare.push(`${relative(ROOT, file)}:${String(src.slice(0, at).split('\n').length)}`);
    }
  }
  expect(bare, 'use clearFolder from tools/holders.ts in these teardowns').toEqual([]);
});
