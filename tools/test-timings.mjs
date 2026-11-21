/*
 * Records how long each unit test file took, for the shard sequencer.
 *
 * Runs the unit suite once with Vitest's JSON reporter and writes each file's
 * duration, by its path from the root, to `tools/test-timings.json`. Run it on
 * a quiet machine after a change that moves files between the packages, so the
 * split the shards get stays close to even.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), 'ahpd-timings-'));
const out = join(scratch, 'unit.json');
try {
  // The unit script's own arguments, plus the reporter, so the run is the one CI runs.
  execFileSync('pnpm', ['test:unit', '--reporter=json', `--outputFile=${out}`], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  const report = JSON.parse(readFileSync(out, 'utf8'));
  const timings = {};
  for (const file of report.testResults) {
    const key = relative(root, file.name).split('\\').join('/');
    timings[key] = Math.max(1, file.endTime - file.startTime);
  }
  const sorted = Object.fromEntries(Object.entries(timings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(join(root, 'tools', 'test-timings.json'), `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} file timings to tools/test-timings.json.`);
}
finally {
  rmSync(scratch, { recursive: true, force: true });
}
