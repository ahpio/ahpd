import { readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';

/*
 * The processes still working in folders a case is about to remove.
 *
 * A process a case started by a port, or one its child started, is not a child
 * the case holds, and a `SIGKILL` of the child does not end it. Each of them
 * was told its folder through its environment - `HOME`, `XDG_STATE_HOME`,
 * `DOCKER_FAKE_STATE` - so a process whose environment names a path in one of
 * the folders is one that can still write there. Read from `/proc`, so none is
 * found where there is no `/proc`.
 */

/** Whether `value` is `folder` or a path inside it. */
const inside = (value: string, folder: string): boolean => value === folder || value.startsWith(folder + sep);

/** The pids whose environment names a path in one of `folders`, this process left out. */
export const holders = (folders: readonly string[]): number[] => {
  let pids: string[];
  try { pids = readdirSync('/proc').filter((one) => /^\d+$/u.test(one)); }
  catch { return []; }
  return pids.flatMap((pid) => {
    if (Number(pid) === process.pid) return [];
    try {
      const values = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').map((entry) => entry.slice(entry.indexOf('=') + 1));
      return values.some((value) => folders.some((folder) => inside(value, folder))) ? [Number(pid)] : [];
    }
    catch { return []; }
  });
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
