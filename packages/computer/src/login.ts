/**
 * An ssh login as a connector: the `ssh` adapter, and the logins it holds open.
 *
 * A login is how this host reaches one box - its destination, its port, the
 * box it goes through, and the key it logs in with - and nothing about what
 * the box is for, which is the computer's. Only the plugin that registers an
 * adapter sees its connectors, so every reach over ssh this plugin makes reads
 * the login from here.
 *
 * A login logs in one of three ways. `agent` is the daemon user's own `ssh`:
 * its agent, its `~/.ssh/config` and its keys. `file` names a key file on this
 * host. `vault` keeps the key in the vault, and the plugin hands it to `ssh`
 * through an `ssh-agent` of this login's own, which holds that key and no
 * other, so a box is never offered another login's key. `ssh.vaultKey: file`
 * writes the key to a file of the login's own instead, for a host where an
 * agent cannot be started.
 *
 * Every login keeps the host key of its box in a known-hosts file of its own,
 * under the login's name rather than the box's address: the first key is
 * accepted and every later one must be the same, as VS Code refuses a changed
 * key until the person forgets the host.
 * https://github.com/microsoft/vscode/blob/ce997d62c79464a0c070c3d2654198f0391e1809/src/vs/platform/agentHost/common/sshHostKeyPolicy.ts
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, CheckResult, Connector, ConnectorOwner, LogLevel } from '@ahpd/sdk';
import { sshReach } from './ssh.js';
import type { SshProgram, SshTarget } from './ssh.js';

/** The adapter's name, and the `adapter` every ssh connector carries. */
export const SSH_ADAPTER = 'ssh';

/** How a login logs in. */
export type LoginAuth = 'agent' | 'file' | 'vault';

/** How a `vault` key is handed to `ssh`: an agent of the login's own, or a file of its own. */
export type VaultKey = 'agent' | 'file';

/** One open login, as every reach over ssh reads it. */
export interface Login {
  /** The connector's id. */
  id: string;
  /** Whose connector it is. */
  owner: ConnectorOwner;
  /** How it logs in. */
  auth: LoginAuth;
  /** Everything `ssh` is given to reach the box. */
  target: SshTarget;
  /** Settled once the login can be used: its agent holds its key, or its key file is written. */
  ready: Promise<void>;
}

/** The logins open now, by connector id. */
export interface Logins {
  get(id: string): Login | undefined;
  ids(): string[];
}

/** What the adapter is built with. */
export interface LoginOptions {
  /** The folder each login keeps its known-hosts file, and a `file` vault key, under. */
  folder: string;
  /** How a `vault` key is handed to `ssh`. `agent` when absent. */
  vaultKey?: VaultKey;
  /** How the `ssh` program is run. */
  program: SshProgram;
  /** The platform the daemon runs on, `process.platform` when absent. */
  platform?: NodeJS.Platform;
  /**
   * Whether people sign in to this host. A person's or a team's login then
   * keeps its key in the vault: `agent` and `file` log in with the daemon
   * user's own agent and key files, which are the host's to use.
   */
  hasUsers?: boolean;
  /** The program that holds a key and the words before its own, `ssh-agent` when absent. */
  agent?: string[];
  /** The program that gives one a key and the words before its own, `ssh-add` when absent. */
  add?: string[];
  /** Where a login's own lines go. */
  log?: (line: string, level?: LogLevel) => void;
}

/** How long a login's agent is given to make its socket, in milliseconds. */
const AGENT_START_MS = 5_000;

/** How long `ssh-add` is given to load one key, in milliseconds. */
const ADD_MS = 10_000;

/** The form a person fills in to make an ssh connector. */
const SCHEMA = {
  type: 'object',
  properties: {
    destination: {
      type: 'string',
      minLength: 1,
      title: 'Destination',
      description: 'user@host, or a Host from the daemon user\'s ssh config.',
    },
    port: { type: 'string', title: 'Port', description: 'The ssh port, when it is not 22.' },
    jump: { type: 'string', title: 'Jump host', description: 'A box to go through first, as ssh -J takes it.' },
    auth: {
      type: 'string',
      title: 'Log in with',
      enum: ['agent', 'file', 'vault'],
      enumLabels: ['ssh agent', 'Key file', 'Key in the vault'],
      enumDescriptions: [
        'The daemon user\'s own ssh agent and ssh config.',
        'A private key file on this host.',
        'A private key kept in the vault, held by an agent of this login\'s own.',
      ],
      default: 'agent',
    },
    identity: { type: 'string', title: 'Key file', description: 'The private key file, for Key file.' },
    key: { type: 'string', secret: true, title: 'Private key', description: 'The private key, for Key in the vault. It has no passphrase.' },
    hostKey: {
      type: 'string',
      title: 'Host key',
      description: 'The box\'s public host key, such as ssh-ed25519 AAAA... Empty accepts the first key the box shows.',
    },
  },
  required: ['destination'],
} as const;

/** A value the form holds, as text, or nothing when it is empty. */
const textOf = (config: Record<string, unknown>, key: string): string | undefined => {
  const said = config[key];
  if (typeof said === 'number') return String(said);
  return typeof said === 'string' && said.trim() !== '' ? said.trim() : undefined;
};

/**
 * Whether a value may stand in an `ssh` argument: no space or control
 * character, and no leading `-`, which `ssh` would read as one of its own
 * options, such as `-oProxyCommand=`, and run.
 */
const isWord = (value: string): boolean => !value.startsWith('-') && !/[\s\x00-\x1f\x7f]/.test(value);

/** A host key line's key: its type and its base64, on one line, with a comment allowed after. */
const HOST_KEY = /^[A-Za-z0-9@._+-]+ [A-Za-z0-9+/]+={0,3}( [^\r\n]*)?$/;

/** The name a login's host key is kept under. */
export const aliasOf = (id: string): string => `ahpd-ssh-${id}`;

/** A key's text with the one newline at its end that `ssh` and `ssh-add` need. */
const keyText = (key: string): string => `${key.replace(/\r\n/g, '\n').trimEnd()}\n`;

/**
 * The SHA256 fingerprint of a public key line, as `ssh-keygen -l` writes it.
 *
 * `undefined` when the line holds no key `ssh` would read.
 */
export const fingerprintOf = (line: string): string | undefined => {
  const fields = line.trim().split(/\s+/);
  const blob = fields.find((one, at) => at > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(one) && one.length > 32);
  if (blob === undefined) return undefined;
  return `SHA256:${createHash('sha256').update(Buffer.from(blob, 'base64')).digest('base64').replace(/=+$/, '')}`;
};

/** One program run to its end, with what it printed. */
const ranOnce = (command: string, args: string[], env: Record<string, string>, timeout: number, input?: string): Promise<{ code: number; said: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let said = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => { said += chunk; });
    child.stderr?.on('data', (chunk: string) => { said += chunk; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeout);
    (timer as { unref?: () => void }).unref?.();
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, said: said.trim() }); });
    if (input !== undefined) {
      child.stdin?.on('error', () => {});
      child.stdin?.end(input);
    }
  });

/** Wait for a file to appear, or throw when it does not in time. */
const appeared = async (path: string, within: number, gone: () => string | undefined): Promise<void> => {
  const until = Date.now() + within;
  while (!existsSync(path)) {
    const why = gone();
    if (why !== undefined) throw new Error(why);
    if (Date.now() > until) throw new Error(`its agent did not make ${path} within ${within}ms`);
    await new Promise((done) => { setTimeout(done, 25); });
  }
};

/** What a failed reach means, from `ssh`'s last line. */
export const resultOf = (said: string): CheckResult['result'] => {
  if (/IDENTIFICATION HAS CHANGED|Host key verification failed/i.test(said)) return 'failed';
  if (/Permission denied|Too many authentication failures|no such identity|Load key|invalid format/i.test(said)) return 'denied';
  if (/did not answer within|timed out|Could not resolve|No route to host|Connection refused|Network is unreachable|Connection closed/i.test(said)) return 'unreachable';
  return 'failed';
};

/**
 * The `ssh` adapter, and the logins its connectors hold open.
 *
 * `open` is where a login starts: it is checked, its known-hosts file is
 * made, and a `vault` key is handed to its agent or written to its file. What
 * cannot be done there is a sentence thrown, which the host shows on the
 * connector's row.
 */
export const sshLogins = (options: LoginOptions): { adapter: Adapter; logins: Logins } => {
  const open = new Map<string, Login>();
  const platform = options.platform ?? process.platform;
  const vaultKey = options.vaultKey ?? 'agent';

  /** The folder one login keeps its files in, made the first time it is asked for. */
  const folderOf = (id: string): string => {
    const at = join(options.folder, id);
    mkdirSync(at, { recursive: true, mode: 0o700 });
    return at;
  };

  /**
   * Start an agent that holds this one key, and answer its socket and what stops it.
   *
   * The socket's folder is a fresh one under the system's temporary folder: a
   * Unix socket path has a length limit near 100 bytes, which a configuration
   * folder deep in a home directory can pass.
   */
  const agentFor = (id: string, key: string, pub: string): { socket: string; ready: Promise<void>; stop: () => void } => {
    const dir = mkdtempSync(join(tmpdir(), 'ahpd-ssh-'));
    const socket = join(dir, 'agent.sock');
    let ended: string | undefined;
    const [agent = 'ssh-agent', ...agentWords] = options.agent ?? [];
    const child = spawn(agent, [...agentWords, '-D', '-a', socket], { stdio: 'ignore', windowsHide: true });
    child.on('error', (error) => { ended = `its agent could not be started: ${error.message}`; });
    child.on('exit', (code) => { ended ??= `its agent stopped with code ${String(code)}`; });
    const ready = (async () => {
      await appeared(socket, AGENT_START_MS, () => ended);
      const [add = 'ssh-add', ...addWords] = options.add ?? [];
      const added = await ranOnce(add, [...addWords, '-q', '-'], { SSH_AUTH_SOCK: socket }, ADD_MS, keyText(key));
      if (added.code !== 0) throw new Error(`its key was not loaded into its agent: ${added.said || `ssh-add exited ${String(added.code)}`}`);
      // The agent's public key, named to ssh with `IdentitiesOnly`, so the
      // daemon user's own key files are never offered in its place.
      const listed = await ranOnce(add, [...addWords, '-L'], { SSH_AUTH_SOCK: socket }, ADD_MS);
      const line = listed.said.split('\n').find((one) => one.trim() !== '');
      if (listed.code !== 0 || line === undefined) throw new Error(`its agent did not list its key: ${listed.said || `ssh-add exited ${String(listed.code)}`}`);
      writeFileSync(pub, `${line.trim()}\n`, { mode: 0o600 });
    })();
    // A login whose agent failed says so on its next reach and its check, not
    // as an error nobody waited for.
    ready.catch((error: unknown) => { options.log?.(`the ssh login ${id} is not usable: ${error instanceof Error ? error.message : String(error)}`, 'warn'); });
    return {
      socket,
      ready,
      stop: () => {
        child.kill();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  };

  const adapter: Adapter = {
    name: SSH_ADAPTER,
    title: 'ssh login',
    description: 'How this host logs in to one box over ssh.',
    schema: SCHEMA as unknown as Record<string, unknown>,
    capabilities: [],
    open: (connector: Connector) => {
      const config = connector.config;
      const destination = textOf(config, 'destination');
      if (destination === undefined) throw new Error('an ssh login needs a destination, user@host or a Host from the ssh config');
      if (!isWord(destination)) throw new Error('an ssh login\'s destination is one word that does not start with -');
      const said = textOf(config, 'auth') ?? 'agent';
      if (said !== 'agent' && said !== 'file' && said !== 'vault') throw new Error(`auth is agent, file or vault, and ${said} is none of them`);
      const auth: LoginAuth = said;
      const identity = textOf(config, 'identity');
      const key = textOf(config, 'key');
      if (auth === 'file' && identity === undefined) throw new Error('an ssh login that logs in with a key file names the file in identity');
      if (auth === 'vault' && key === undefined) throw new Error('an ssh login that keeps its key in the vault needs the key');
      if (options.hasUsers === true && connector.owner !== 'host' && auth !== 'vault') {
        throw new Error(`a person's or a team's ssh login keeps its key in the vault; ${auth} logs in with the daemon user's own keys, which only a host login may`);
      }
      if (auth === 'vault' && vaultKey === 'agent' && platform === 'win32') {
        throw new Error('this host cannot start an ssh agent of a login\'s own; set the computer plugin\'s ssh.vaultKey to file to keep the key in a file instead');
      }

      const folder = folderOf(connector.id);
      const knownHosts = join(folder, 'known_hosts');
      const alias = aliasOf(connector.id);
      // A host key the person gave is the only one accepted: the file is
      // written again at every open, so a key changed on the form is the one
      // the next reach checks.
      const hostKey = textOf(config, 'hostKey');
      if (hostKey !== undefined && !HOST_KEY.test(hostKey)) throw new Error('hostKey is one public key line, such as ssh-ed25519 AAAA...');
      if (hostKey !== undefined) writeFileSync(knownHosts, `${alias} ${hostKey}\n`, { mode: 0o600 });

      const port = textOf(config, 'port');
      if (port !== undefined && !(/^\d{1,5}$/.test(port) && Number(port) > 0 && Number(port) < 65536)) throw new Error(`port is a number from 1 to 65535, and ${port} is not one`);
      const jump = textOf(config, 'jump');
      if (jump !== undefined && !isWord(jump)) throw new Error('an ssh login\'s jump host is one word that does not start with -');
      const base: SshTarget = {
        destination,
        alias,
        knownHosts,
        ...(port === undefined ? {} : { port }),
        ...(jump === undefined ? {} : { jump }),
        ...(auth === 'file' && identity !== undefined ? { identity } : {}),
      };

      let stop: (() => void) | undefined;
      let login: Login;
      if (auth === 'vault' && vaultKey === 'agent') {
        const pub = join(folder, 'key.pub');
        rmSync(pub, { force: true });
        const agent = agentFor(connector.id, key as string, pub);
        stop = () => { agent.stop(); rmSync(pub, { force: true }); };
        login = {
          id: connector.id,
          owner: connector.owner,
          auth,
          target: { ...base, identity: pub, agentSocket: agent.socket, env: { SSH_AUTH_SOCK: agent.socket } },
          ready: agent.ready,
        };
      }
      else if (auth === 'vault') {
        const file = join(folder, 'key');
        writeFileSync(file, keyText(key as string), { mode: 0o600 });
        stop = () => { rmSync(file, { force: true }); };
        login = { id: connector.id, owner: connector.owner, auth, target: { ...base, identity: file }, ready: Promise.resolve() };
      }
      else {
        login = { id: connector.id, owner: connector.owner, auth, target: base, ready: Promise.resolve() };
      }
      open.set(connector.id, login);
      return () => {
        if (open.get(connector.id) === login) open.delete(connector.id);
        stop?.();
      };
    },

    /*
     * One `ssh ... true` through the login: it answers `ok` with the host key
     * it now holds for the box, and the reason in ssh's own words otherwise.
     */
    check: async (connector: Connector): Promise<CheckResult> => {
      const login = open.get(connector.id);
      if (login === undefined) return { result: 'failed', message: `the ssh login ${connector.id} is not open` };
      try {
        await login.ready;
      }
      catch (error) {
        return { result: 'failed', message: error instanceof Error ? error.message : String(error) };
      }
      const reached = await sshReach(options.program, login.target).reached();
      if (!reached.up) {
        const result = resultOf(reached.said);
        const changed = /IDENTIFICATION HAS CHANGED|Host key verification failed/i.test(reached.said);
        return {
          result,
          message: changed
            ? `the host key of ${login.target.destination} is not the one this login holds; put the box's new key in Host key if the change is expected (${reached.said})`
            : reached.said,
        };
      }
      const held = existsSync(login.target.knownHosts as string)
        ? readFileSync(login.target.knownHosts as string, 'utf8').split('\n').find((line) => line.startsWith(`${login.target.alias as string} `))
        : undefined;
      const fingerprint = held === undefined ? undefined : fingerprintOf(held);
      return { result: 'ok', message: `${login.target.destination} answered${fingerprint === undefined ? '' : `, host key ${fingerprint}`}` };
    },
  };

  return {
    adapter,
    logins: {
      get: (id) => open.get(id),
      ids: () => [...open.keys()],
    },
  };
};
