import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

/*
 * The processes still working in folders a case is about to remove.
 *
 * A process a case started by a port, or one its child started, is not a child
 * the case holds, and a `SIGKILL` of the child does not end it. Each of them
 * was told its folder through its environment - `HOME`, `XDG_STATE_HOME`,
 * `DOCKER_FAKE_STATE` - so a process whose environment names a path in one of
 * the folders is one that can still write there. Read from `/proc`, and from
 * the marks a fake CLI leaves under `MARKS` while it runs, which name the path
 * it writes, so a holder is found where there is no `/proc` too.
 */

/** Where a fake CLI keeps its mark while it runs: a file named by its pid, holding the path it writes. */
const MARKS = join(tmpdir(), 'ahpd-test-holders');

/** Whether `value` is `folder` or a path inside it. */
const inside = (value: string, folder: string): boolean => value === folder || value.startsWith(folder + sep);

/** The pids whose mark names a path in one of `folders`. */
const marked = (folders: readonly string[]): number[] => {
  let marks: string[];
  try { marks = readdirSync(MARKS).filter((one) => /^\d+$/u.test(one)); }
  catch { return []; }
  return marks.flatMap((pid) => {
    if (Number(pid) === process.pid) return [];
    // A call ended by `SIGKILL` leaves its mark behind, so a mark is only a
    // holder while its pid is alive, and a dead one's mark goes.
    try { process.kill(Number(pid), 0); }
    catch {
      try { rmSync(join(MARKS, pid), { force: true }); }
      catch { /* gone already */ }
      return [];
    }
    try {
      const path = readFileSync(join(MARKS, pid), 'utf8');
      return folders.some((folder) => inside(path, folder)) ? [Number(pid)] : [];
    }
    catch { return []; }
  });
};

/** The pids whose environment, or whose mark, names a path in one of `folders`, this process left out. */
export const holders = (folders: readonly string[]): number[] => {
  let pids: string[];
  try { pids = readdirSync('/proc').filter((one) => /^\d+$/u.test(one)); }
  catch { return marked(folders); }
  return [...new Set([...marked(folders), ...pids.flatMap((pid) => {
    if (Number(pid) === process.pid) return [];
    try {
      const values = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').map((entry) => entry.slice(entry.indexOf('=') + 1));
      return values.some((value) => folders.some((folder) => inside(value, folder))) ? [Number(pid)] : [];
    }
    catch { return []; }
  })])];
};

/** `SIGKILL` every holder of `folders`, until none is left or `ms` has passed. */
export const endHolders = async (folders: readonly string[], ms = 5_000): Promise<void> => {
  const end = Date.now() + ms;
  for (let left = holders(folders); left.length > 0 && Date.now() < end; left = holders(folders)) {
    for (const pid of left) {
      try { process.kill(pid, 'SIGKILL'); }
      catch { /* gone already */ }
    }
    await new Promise((done) => { setTimeout(done, 50); });
  }
};
