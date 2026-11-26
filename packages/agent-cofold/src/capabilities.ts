/**
 * The four `@cofold/tools` capabilities a cofold session runs itself.
 *
 * `files`, `shell`, `web` and `memory` are built by `standardCapabilities` out
 * of the `tools` section a configuration writes, and handed to the cofold agent
 * a turn runs on. cofold executes them in this process, against the machine it
 * runs on - the way the Claude backend's tools run in the Claude CLI - so ahpd
 * reports the calls, asks through the policy and reports the edits rather than
 * running anything ().
 *
 * The section's shape, the search providers and the memory layout are cofold's
 * (cofold decision 123), so this file only places the run: which directory the
 * tools work in - which cofold reads from the run itself - and where memory
 * goes. A tool a host already offers keeps its name, which is what `exclude`
 * is for.
 */

import type { Capability } from '@cofold/agents';
import { basename } from 'node:path';
import { DEFAULT_SHELL, shell, standardCapabilities } from '@cofold/tools';
import type { SearchConfig, ShellSpec, ToolsConfig } from '@cofold/tools';
import { bag, isRecord } from '@ahpd/sdk';

export type { SearchConfig, ShellSpec, ToolsConfig } from '@cofold/tools';

/** All four on, which is what a session whose options name no `tools` gets. */
export const DEFAULT_TOOLS: ToolsConfig = { files: true, shell: true, web: true, memory: true };

/** The syntax a shell program reads: its assignments, and the language a question names. */
export type ShellFamily = 'powershell' | 'bash' | 'cmd';

/**
 * The family of the program a shell call runs through, by its base name.
 *
 * `undefined` for a program this package does not know, whose language a
 * question then leaves out.
 */
export const shellFamilyOf = (spec: ShellSpec = DEFAULT_SHELL): ShellFamily | undefined => {
  const name = basename(spec.command.replace(/\\/gu, '/')).replace(/\.exe$/iu, '').toLowerCase();
  if (name === 'powershell' || name === 'pwsh') return 'powershell';
  if (name === 'sh' || name === 'bash' || name === 'dash' || name === 'zsh') return 'bash';
  if (name === 'cmd') return 'cmd';
  return undefined;
};

/** The language a question names for a shell call, which the SDK knows for two families. */
export const shellLanguageOf = (spec?: ShellSpec): 'powershell' | 'bash' | undefined => {
  const family = shellFamilyOf(spec);
  return family === 'cmd' ? undefined : family;
};

/**
 * The assignments that set `env` before a command, in the syntax of the shell
 * that runs it.
 *
 * cofold's shell takes no environment of its own, so the variables go in the
 * command the shell is given. A program of no known family is given the POSIX
 * syntax.
 */
export const assignmentsFor = (env: Record<string, string>, family: ShellFamily | undefined): string => Object.entries(env)
  .map(([name, value]) => {
    if (family === 'powershell') return `$env:${name}='${value.replace(/'/gu, "''")}';`;
    if (family === 'cmd') return `set "${name}=${value}" &&`;
    return `export ${name}='${value.replace(/'/gu, "'\\''")}';`;
  })
  .join(' ');

/**
 * cofold's own shell, with `env` set before every command.
 *
 * Only the `shell` capability is touched: files, web and memory run no
 * program. The command is prefixed inside `execute`, so the tool keeps its
 * name, words and `subject` - the command a permission rule matches is still
 * the one the model wrote.
 */
const withShellEnv = (capability: Capability, env: Record<string, string>, family: ShellFamily | undefined): Capability => {
  const tools = capability.tools;
  if (capability.id !== 'shell' || tools === undefined) return capability;
  return {
    ...capability,
    tools: async (args) => (await tools(args)).map((tool) => ({
      ...tool,
      execute: (input: unknown, ctx: Parameters<typeof tool.execute>[1]) => {
        const command = (input as { command?: unknown } | undefined)?.command;
        if (typeof command !== 'string' || command === '') return tool.execute(input, ctx);
        return tool.execute({ ...(input as Record<string, unknown>), command: `${assignmentsFor(env, family)} ${command}` }, ctx);
      },
    })),
  };
};

/**
 * The capabilities a session gets, in cofold's own order: files, shell, web and
 * memory, each one on unless the configuration turned it off.
 *
 * `memoryDir` is where memory files go; cofold leaves the memory capability out
 * when it is absent, which is what a session whose store is deliberately in
 * memory gets, rather than a folder under somebody's home. `taken` names the
 * tools the host already offers, which win their names: cofold refuses a run
 * two contributors give one name to, and the host's tool is the more specific
 * contribution - it was named for this deployment, and these are defaults - so
 * the capability's tool of that name is left out. A host that offers
 * `write_file` still gets the capability's other four.
 *
 * `env` is the environment a shell command runs with, set before each command
 * it is given; cofold's shell has no seam of its own for one. `shell` is the
 * program a shell call runs through, cofold's `DEFAULT_SHELL` when absent.
 */
export function capabilitiesOf(
  tools: ToolsConfig,
  args: { workspace: string; memoryDir?: string; env?: Record<string, string>; shell?: ShellSpec },
  taken: Iterable<string> = [],
): Capability[] {
  const standard = standardCapabilities(tools, {
    workspace: args.workspace,
    ...(args.memoryDir === undefined ? {} : { memoryDir: args.memoryDir }),
  });
  const spec = args.shell;
  const built = spec === undefined
    ? standard
    : standard.map((capability) => (capability.id === 'shell' ? shell({ shell: spec }) : capability));
  const family = shellFamilyOf(spec);
  const withEnv = args.env === undefined || Object.keys(args.env).length === 0
    ? built
    : built.map((capability) => withShellEnv(capability, args.env as Record<string, string>, family));
  const names = [...taken];
  return names.length === 0 ? withEnv : withEnv.map((capability) => ({ ...capability, exclude: names }));
}

/** One non-empty string, or nothing for a value this package cannot use. */
const text = (value: unknown): string | undefined =>
  (typeof value === 'string' && value.trim() !== '' ? value : undefined);

/** The providers a `web.search` value names, in the order it lists them, or nothing for one that names none. */
const searchOf = (value: unknown): SearchConfig | undefined => {
  if (!isRecord(value)) return undefined;
  const held = value;
  const search: SearchConfig = {};
  for (const name of Object.keys(held)) {
    if (name === 'brave') {
      const apiKey = text(bag(held.brave).apiKey);
      if (apiKey !== undefined) search.brave = { apiKey };
    }
    else if (name === 'tavily') {
      const apiKey = text(bag(held.tavily).apiKey);
      if (apiKey !== undefined) search.tavily = { apiKey };
    }
    else if (name === 'duckduckgo' && typeof held.duckduckgo === 'boolean') {
      search.duckduckgo = held.duckduckgo;
    }
  }
  return Object.keys(search).length > 0 ? search : undefined;
};

/**
 * The `tools` option, out of whatever a configuration named.
 *
 * This is the loose reading, which `strictTools: false` asks for: every key is
 * taken only when it has the type `ToolsConfig` declares for it, so a value the
 * configuration misspelled is dropped rather than thrown over. Nothing for a
 * value that is not a plain object, and a web value that is neither a boolean
 * nor an object with a usable `search` is left out so the default stands.
 *
 * `files` is a boolean or an object carrying `requireRead`, and a `requireRead`
 * that is not a boolean is dropped, which leaves the rule on, as its default is.
 */
export const toolsOf = (value: unknown): ToolsConfig | undefined => {
  if (!isRecord(value)) return undefined;
  const held = value;
  const tools: ToolsConfig = {};
  if (typeof held.files === 'boolean') tools.files = held.files;
  else if (isRecord(held.files)) {
    const requireRead = held.files.requireRead;
    tools.files = typeof requireRead === 'boolean' ? { requireRead } : {};
  }
  if (typeof held.shell === 'boolean') tools.shell = held.shell;
  if (typeof held.memory === 'boolean') tools.memory = held.memory;
  if (typeof held.web === 'boolean') tools.web = held.web;
  else if (isRecord(held.web)) {
    const search = searchOf(held.web.search);
    tools.web = search === undefined ? {} : { search };
  }
  return tools;
};
