import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bag, readJson, reason, writeJsonAtomic } from '@ahpd/sdk';
import type { ResourceAnnotationsStore } from '@ahpd/sdk';
import type { AnnotationsState } from '@microsoft/agent-host-protocol';

/**
 * The comments on resources outside any session, kept between restarts.
 *
 * One file per resource under `folder`, named by a hash of the URI so any URI
 * makes a safe name, holding the URI beside the protocol's annotations state.
 */
export interface FileResourceAnnotationsOptions {
  folder: string;
  onProblem?(message: string): void;
}

interface StateFile {
  version: 1;
  resource: string;
  state: AnnotationsState;
}

const nameOf = (resource: string): string => `${createHash('sha256').update(resource, 'utf8').digest('hex').slice(0, 32)}.json`;

export function fileResourceAnnotations(options: FileResourceAnnotationsOptions): ResourceAnnotationsStore {
  const told = (message: string): void => { options.onProblem?.(message); };
  const fileOf = (resource: string): string => join(options.folder, nameOf(resource));

  const readFile = (file: string): StateFile | undefined => {
    const read = readJson(file);
    if (!read.ok) {
      if (read.kind !== 'missing') told(`Could not read ${file}: ${reason(read.error)}`);
      return undefined;
    }
    const held = bag(read.value) as Partial<StateFile>;
    if (held.version !== 1 || typeof held.resource !== 'string' || !Array.isArray(held.state?.annotations)) {
      told(`${file} is not a comments file this version can read, and was left alone`);
      return undefined;
    }
    return held as StateFile;
  };

  return {
    read: (resource) => readFile(fileOf(resource))?.state,
    write: (resource, state) => {
      const file: StateFile = { version: 1, resource, state };
      try {
        writeJsonAtomic(fileOf(resource), file);
      }
      catch (error) {
        told(`Could not write ${fileOf(resource)}: ${reason(error)}`);
      }
    },
    list: () => {
      let names: string[];
      try { names = readdirSync(options.folder).filter((one) => one.endsWith('.json')); }
      catch { return []; }
      return names.map((one) => readFile(join(options.folder, one))?.resource).filter((one): one is string => one !== undefined);
    },
  };
}
