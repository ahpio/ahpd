import { beforeEach, expect, it } from 'vitest';
import { loggerOf } from '../src/log.js';
import { foldHostOptions, pluginHost } from '../src/plugins/plugins.js';
import { memorySessions } from '../src/sessions/sessions.js';
import { sdkVersion } from '../src/version.js';
import { hostTools } from '../src/tools/index.js';
import {
  createHost, echo, machine, resetSdk,
} from './support/host.js';
import {
  directory, hello, peer, signIn,
} from './users-gate-helpers.js';
import type { Agent, Start } from '../src/types/agent.js';
import type { HostOptions, HostTool } from '../src/types/host.js';
import type { LoaderContext } from '../src/types/plugin.js';
import { WORK } from './support/work.js';

beforeEach(resetSdk);

/*
 * The artifact tools are offered, bound and instructed on the root config's
 * word alone, as the reference host answers `artifactTools` in its root
 * config: absent, the model is told nothing about artifacts and holds no
 * artifact tool; set, the tools are bound and their one instruction rides the
 * chat's first start, as it does today.
 *
 * Read from the seam the backends see - the `Start` a plugin's session makes -
 * rather than from any host-internal list, so the test holds wherever the gate
 * is wired: in what `hostTools()` builds, in the permitted filter, or in a
 * per-session hook.
 */

const DIR = WORK;

const ARTIFACT_TOOL_NAMES = ['add_artifact_or_reference', 'remove_artifact_or_reference', 'list_artifacts_and_references'];
const ARTIFACT_INSTRUCTION_MARK = 'Record notable artifacts and references';

/** The context every plugin in this repository is handed, without a daemon. */
const context = (): LoaderContext => ({
  path: DIR, paths: [DIR], version: sdkVersion(), hostName: 'test', configDir: DIR, log: loggerOf(() => {}), say: () => {},
});

/** The values a daemon keeps in its root-config file, the way it hands its store. */
const rootConfig = (held: Record<string, unknown>): NonNullable<HostOptions['rootConfigStore']> => ({
  read: () => ({ ...held }),
  write: () => {},
});

/**
 * One host with the SDK's own tool set as its contribution, one plugin that
 * asks for sessions, and the starts its sessions made.
 */
function starting(root: Record<string, unknown> = {}) {
  const sessions = memorySessions();
  const base = echo({ path: DIR, pace: 0 });
  const seen: Start[] = [];
  const agent: Agent = {
    ...base,
    create: (start: Start) => {
      seen.push(start);
      return base.create(start);
    },
  };
  const { host: plugin, contribution } = pluginHost('bots', context());
  const { options, problems } = foldHostOptions({
    path: DIR,
    agents: [agent],
    ...machine(),
    sessions,
    users: directory({ soft: ['session:*'] }),
    tools: hostTools(),
    rootConfigStore: rootConfig(root),
  } as HostOptions, [contribution]);
  const host = createHost(options);
  return { plugin, host, sessions, seen, problems };
}

/** A client signed in as `who`, which is what a run on their behalf needs. */
const open = async (host: ReturnType<typeof createHost>): Promise<void> => {
  const client = host.accept(peer());
  await hello(client, 'soft');
  await signIn(client, 'soft');
};

/** The names of the tools one `Start` was handed. */
const boundNames = (at: number, seen: Start[]): string[] =>
  (seen.at(at)?.tools ?? []).map((one) => one.definition.name);

it('offers no artifact tool and says nothing about artifacts by default', async () => {
  const { plugin, host, seen, problems } = starting();
  expect(problems).toEqual([]);
  await open(host);

  await plugin.startSession({ owner: 'user:soft', prompt: 'Say hello' });

  expect(seen).toHaveLength(1);
  const names = boundNames(0, seen);
  for (const name of ARTIFACT_TOOL_NAMES) expect(names).not.toContain(name);
  const told = seen[0]?.instructions ?? [];
  const aboutArtifacts = told.filter((one) => one.includes(ARTIFACT_INSTRUCTION_MARK));
  expect(aboutArtifacts).toEqual([]);
});

it('binds the artifact tools and carries their instruction once the config asks for them', async () => {
  const { plugin, host, seen, problems } = starting({ artifactTools: true });
  expect(problems).toEqual([]);
  await open(host);

  await plugin.startSession({ owner: 'user:soft', prompt: 'Say hello' });

  expect(seen).toHaveLength(1);
  const names = boundNames(0, seen);
  for (const name of ARTIFACT_TOOL_NAMES) expect(names).toContain(name);
  const told = seen[0]?.instructions ?? [];
  expect(told.filter((one) => one.includes(ARTIFACT_INSTRUCTION_MARK))).toHaveLength(1);
});

