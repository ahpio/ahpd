/**
 * Machines on boxes this host does not own, reached over `ssh`.
 *
 * An ssh machine is a box somebody already has, made into a computer by a
 * create: the create names the `ssh` connector the box is reached with and
 * what the box is for, and the record is kept beside the configuration. A box
 * carries no label of this host's, so there is nothing on it to start or to
 * stop, and a remove forgets the record and leaves the box as it was. What
 * this host puts there is the ahpd a session's host runs, in the folder of the
 * user it reaches the box as.
 *
 * The remote command is one string the box's login shell parses, because `ssh`
 * has no flag for a remote directory and none for a remote variable - `ssh(1)`.
 * So every remote word goes through `quote`, and a value that reaches the box
 * is a value this module wrote between single quotes.
 */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { Owner, Spawn, SpawnOptions } from '@ahpd/sdk';
import { copyFolder, tarOf } from './hostcopy.js';
import type { CopyOptions } from './hostcopy.js';
import { copyCommand, HOST_INSTALL_COMMAND, hostInstallOf, isHostInstall } from './hostinstall.js';
import type { Part, Tarball } from './parts.js';
import type { ComputerRuntime, ExecResult, Machine, MachineStats, RuntimeCapabilities } from './runtime.js';
import { checkServer, SERVER_CHECK } from './servercheck.js';
import type { ServerReport } from './servercheck.js';
import type { SshBoxRecord } from './owners.js';
import type { LogLevel } from '@ahpd/sdk';

/** What `capabilities` reports for this runtime. */
const CAPABILITIES: RuntimeCapabilities = {
  runtime: 'ssh',
  actions: ['exec'],
  resources: ['status', 'capabilities', 'stats', 'server'],
};

/**
 * How long `ssh` is given to reach a box, in seconds, before it refuses: VS
 * Code's handshake bound for an ssh host, 30 seconds.
 * https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/agentHost/node/sshRemoteAgentHostService.ts#L142
 */
const DEFAULT_CONNECT_TIMEOUT = 30;

/**
 * How much longer than `ConnectTimeout` one `ssh` process is given.
 *
 * The program's own bound is what a box that answers and then hangs needs: a
 * connect timeout says nothing about a command that never returns, and a
 * listing that never ends is a daemon whose startup never ends either.
 */
const MARGIN_MS = 10_000;

/**
 * How much longer the server check is given than a plain command.
 *
 * `docker info` and `virsh list` each wait on a daemon of their own, which a
 * box that has one stopped can take a while to refuse.
 */
const CHECK_MARGIN_MS = 10_000;

/** The word a box that answered is written as, in a listing and in `state`. */
const RUNNING = 'running';

/**
 * One box: how it is reached, and what it is for.
 *
 * There is no image and no label here: a box somebody set up by hand is made
 * of neither, and what this host knows about it is its login and its record.
 */
export interface SshMachine {
  /** What `ssh` is given as the host, `user@host` or a name from its own config. */
  destination: string;
  /** The port, when it is not the one `ssh` would use. */
  port?: string;
  /** The private key, when `ssh` would not pick one itself. */
  identity?: string;
  /**
   * The name the box's host key is kept under, in place of its address.
   *
   * A login's known-hosts file holds one box, so the key is found by the
   * login's own name whatever the destination resolves to.
   */
  alias?: string;
  /** The agent this box's key is held in, when the login keeps one of its own. */
  agentSocket?: string;
  /** Variables the `ssh` program is run with to reach this box, over the program's own. */
  env?: Record<string, string>;
  /** Where a command starts on the box, when the login directory is not it. */
  workdir?: string;
  /**
   * The command that starts a nested host there, run as it is written with
   * nothing installed, as VS Code runs an agent host command it is given.
   * Absent, it is the ahpd this host installs in the box user's folder.
   * https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/agentHost/node/sshRemoteAgentHostService.ts#L913-L929
   */
  host?: string[];
  /** The agents this box is prepared for, as a machine carries them in a label. */
  agents?: string[];
}

/** One box as the runtime keeps it: its record, and who made it. */
export interface SshBox extends SshBoxRecord {
  owner?: Owner;
  team?: string;
  project?: string;
}

/**
 * Where the runtime's boxes come from, and where a create and a remove go.
 *
 * The plugin's, because a box's record lives beside the configuration and its
 * login is a connector, and neither is this runtime's to keep.
 */
export interface SshBoxes {
  /** Every box, by the name its machine id is spelled with. */
  records(): Record<string, SshBox>;
  /** The login a connector id names, ready to reach, or the sentence that says why there is none. */
  login(connector: string): Promise<SshTarget | string>;
  /** Record a box, or throw the sentence that says why it is not one. */
  add(name: string, box: SshBox): Promise<void>;
  /** Forget a box's record. Nothing on the box changes. */
  forget(name: string): void;
}

/** What this runtime was configured with. */
export interface SshOptions {
  /** The program that reaches a box. `ssh` unless a configuration said otherwise. */
  command?: string;
  /** Arguments before its own, for a wrapper or a jump host. */
  args?: string[];
  /** Environment for the program, merged over this process's own. */
  env?: Record<string, string>;
  /** The boxes, and the logins they are reached with. */
  boxes: SshBoxes;
  /** How long `ssh` is given to reach a box, in seconds. */
  connectTimeout?: number;
  /**
   * How often each box is checked, in seconds, when the operator asked for it.
   *
   * Absent, only a listing moves the meter: a box's up time is what the moments
   * a client listed saw, and nothing is reached between two of them. Set, every
   * box is reached that often, so a stretch of up time ends at a check rather
   * than at whoever lists next.
   *
   * The plugin owns the timer rather than this runtime, because a runtime is
   * never told that the host is closing: what the option says is how often, and
   * what stops it is the plugin's own close.
   */
  pollSeconds?: number;
  /** The parts the ahpd installed on a box is made of, `versions.json`'s when absent. */
  parts?: Part[];
  /** The ahpd part's lock that install runs `npm ci` from, the one beside `versions.json` when absent. */
  lock?: Tarball[];
  /** How the files a box cannot download are held, the user's cache folder and npm when absent. */
  copy?: CopyOptions;
  /** Where an ahpd installed on a box, or one run in its place, is said. */
  log?: (line: string, level?: LogLevel) => void;
}

/**
 * One word, as the box's login shell reads it back.
 *
 * Single quotes, with a quote inside written as `'\''`: that is the one
 * sequence a POSIX shell reads as a literal quote inside a quoted word, and it
 * is the whole of what quoting means here - `$()` and a backtick are literal
 * inside single quotes, and so are `;`, a space and a newline.
 */
export const quote = (word: string): string => `'${word.split("'").join("'\\''")}'`;

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** A list of words, or nothing when the value is not a list at all. */
const words = (value: unknown): string[] | undefined => (Array.isArray(value) ? value.map(String) : undefined);

/** What one `ssh` process printed, and how it ended. */
export interface Ran {
  code: number;
  stdout: string;
  stderr: string;
  /** Whether the process was killed for taking too long rather than answering. */
  timedOut: boolean;
}

/**
 * The one refusal the verbs that would start or stop a box answer with.
 *
 * A box is on a machine somebody else set up, so there is nothing here to
 * start or stop: what a person wants is the box's own service manager, and a
 * host that answered this by running one would be a daemon acting on a
 * machine it does not own.
 */
const madeElsewhere = (id: string): Error =>
  new Error(`${id} is a box this host reaches over ssh, and it is not started or stopped here`);

/** What a box's answer came to: whether it is up, and its last line either way. */
export interface Reached {
  up: boolean;
  /** `ssh`'s own last line, which is the whole of why a box did not answer. */
  said: string;
}

const lastLine = (said: string): string => {
  const lines = said.split('\n').map((one) => one.trim()).filter((one) => one !== '');
  return lines[lines.length - 1] ?? '';
};

/**
 * One `ssh` process, and what it printed.
 *
 * The program's own environment is this process's with the option's merged over
 * it: an operator reaches a box through the ssh agent, a `~/.ssh/config` entry
 * and a key of their own, so the daemon's environment is what an ssh already
 * works with, and the option is the one place an extra variable is said.
 */
const ran = (options: SshProgram, args: string[], timeout: number, input?: string | Uint8Array | Readable): Promise<Ran> => new Promise((resolve, reject) => {
  const child = spawn(options.command ?? 'ssh', [...(options.args ?? []), ...args], {
    // Stdin only for a script or a file sent to the box: anything else has
    // nothing to read, and an open pipe would be one it waits on.
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env ?? {}) },
    // On Windows a daemon has no console, so each `ssh.exe` would open a
    // window of its own for every listing and check.
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
  // A timer nobody is waiting on is not a reason for the process to stay up.
  (timer as { unref?: () => void }).unref?.();
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => { stdout += chunk; });
  child.stderr?.on('data', (chunk: string) => { stderr += chunk; });
  // A program that is not installed is an error rather than an exit code, and
  // it is the one failure a caller most needs to read.
  child.on('error', (error) => { clearTimeout(timer); reject(error); });
  if (input !== undefined) {
    // A box that closed early is answered by the exit code below, not by a
    // write that failed on the way.
    child.stdin?.on('error', () => {});
    if (input instanceof Readable) {
      // A file that could not be read on the way ends the process, which would
      // otherwise wait for the rest of it, and is what the caller is told.
      input.on('error', (error) => { clearTimeout(timer); child.kill('SIGKILL'); reject(error); });
      if (child.stdin !== null) input.pipe(child.stdin);
    }
    else child.stdin?.end(input);
  }
  child.on('close', (code) => {
    clearTimeout(timer);
    if (input instanceof Readable) input.destroy();
    resolve({ code: code ?? 0, stdout, stderr, timedOut });
  });
});

/**
 * One `ssh` process whose stdout lands in a file, byte for byte.
 *
 * A bundle on a pipe is a pack, holding bytes that are not UTF-8, so it is
 * never read as text: only stderr is. The write is waited for as well as the
 * process, so the file is whole when this answers.
 */
const poured = (options: SshProgram, args: string[], timeout: number, path: string): Promise<{ code: number; stderr: string }> => new Promise((resolve, reject) => {
  const child = spawn(options.command ?? 'ssh', [...(options.args ?? []), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env ?? {}) },
    windowsHide: true,
  });
  let stderr = '';
  const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeout);
  (timer as { unref?: () => void }).unref?.();
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => { stderr += chunk; });
  const out = createWriteStream(path, { mode: 0o600 });
  if (child.stdout === null) out.end();
  else child.stdout.pipe(out);
  const ended = new Promise<number>((done, failed) => {
    child.on('error', failed);
    child.on('close', (code) => { clearTimeout(timer); done(code ?? 0); });
  });
  const written = new Promise<void>((done, failed) => {
    out.on('error', failed);
    out.on('close', () => { done(); });
  });
  Promise.all([ended, written]).then(([code]) => { resolve({ code, stderr }); }, reject);
});

/**
 * How long a command that moves a repository is given: a bundle sent to a
 * machine, or one read back from it. A connect timeout says nothing about how
 * long a large history takes on the wire.
 */
const TRANSFER_MS = 10 * 60_000;

/** How the `ssh` program is run, whichever box it reaches. */
export type SshProgram = Pick<SshOptions, 'command' | 'args' | 'env' | 'connectTimeout'>;

/** The program with a box's own variables over its own, which is what reaches that box. */
const programFor = (program: SshProgram, target: SshMachine): SshProgram =>
  (target.env === undefined ? program : { ...program, env: { ...(program.env ?? {}), ...target.env } });

/** One destination, with what reaching it takes beyond a box an operator wrote. */
export interface SshTarget extends SshMachine {
  /** The box `ssh -J` goes through first, for a destination on a network this host has no route to. */
  jump?: string;
  /** A known-hosts file of its own, which a new host key is accepted into. */
  knownHosts?: string;
}

/** What one destination answers, each verb one run of the `ssh` program. */
export interface SshReach {
  /** The `ssh` arguments for one remote string, after the program's own. */
  argv(remote: string): string[];
  /** Whether the destination answers `true`, and `ssh`'s last line when it does not. */
  reached(): Promise<Reached>;
  /** The program and arguments that run one command there. */
  how(asked: SpawnOptions): Spawn;
  exec(command: string[], env?: Record<string, string>): Promise<ExecResult>;
  /**
   * One command, with its stdout and stderr apart and `input` on its stdin.
   *
   * Given as long as a transfer, since it is what sends a bundle in and runs
   * the fetch that reads it, and what installs ahpd on a box.
   */
  ran(command: string[], input?: Uint8Array | Readable): Promise<Ran>;
  /** One command, with its stdout landing in `path` byte for byte. */
  pour(command: string[], path: string): Promise<{ code: number; stderr: string }>;
  stats(): Promise<MachineStats | undefined>;
  /** The server check, sent to the destination's `sh`; `id` names it in a refusal. */
  check(id: string): Promise<ServerReport>;
}

/**
 * One destination reached over `ssh`: an operator's box, or a machine this host made.
 *
 * `-T` because no terminal is asked for: a listing and a command both read
 * what the box printed rather than what a terminal would have done to it.
 * `BatchMode=yes` so a box that wants a password fails with its own sentence
 * instead of waiting for one forever - it is the flag that turns a hang into
 * an answer.
 *
 * A target with `knownHosts` is a machine whose host key nobody has seen: its
 * key is accepted the first time into that file, never into the person's own.
 * The file is written unhashed, so a removed machine's address can be found
 * in it again. `-J` reaches the jump with the person's own configuration,
 * because `ssh` gives the jump none of the `-o` options here.
 */
export const sshReach = (given: SshProgram, target: SshTarget): SshReach => {
  const program = programFor(given, target);
  const connect = program.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
  // The connect timeout is the box's; this is the process's, and it is the one
  // that ends a command the box accepted and never finished.
  const bound = connect * 1000 + MARGIN_MS;

  const argv = (remote: string): string[] => [
    '-T',
    '-o', 'BatchMode=yes',
    '-o', `ConnectTimeout=${connect}`,
    ...(target.knownHosts === undefined
      ? []
      : ['-o', 'StrictHostKeyChecking=accept-new', '-o', `UserKnownHostsFile=${target.knownHosts}`, '-o', 'HashKnownHosts=no']),
    ...(target.alias === undefined ? [] : ['-o', `HostKeyAlias=${target.alias}`]),
    ...(target.agentSocket === undefined ? [] : ['-o', `IdentityAgent=${target.agentSocket}`]),
    ...(target.jump === undefined ? [] : ['-J', target.jump]),
    ...(target.port === undefined ? [] : ['-p', target.port]),
    // A key named for this box is the only one offered to it, so a login's
    // key is never tried against another login's box.
    ...(target.identity === undefined ? [] : ['-i', target.identity, '-o', 'IdentitiesOnly=yes']),
    target.destination,
    '--',
    remote,
  ];

  /**
   * The remote string for one command, with its directory and its variables.
   *
   * `ssh` takes none of Docker's own flags: `-w` becomes a `cd` and `-e`
   * becomes `env`, both written into the string the login shell parses. The
   * directory is the box's own `workdir` and never a path from this host -
   * a path here is not a path there.
   */
  const remote = (command: string[], env?: Record<string, string>): string => {
    const variables = Object.entries(env ?? {}).map(([name, value]) => quote(`${name}=${value}`));
    const said = [
      ...(variables.length === 0 ? [] : ['env', ...variables]),
      ...command.map(quote),
    ].join(' ');
    return target.workdir === undefined ? said : `cd ${quote(target.workdir)} && ${said}`;
  };

  return {
    argv,

    reached: async () => {
      const held = await ran(program, argv('true'), bound);
      if (held.code === 0) return { up: true, said: '' };
      if (held.timedOut) return { up: false, said: `it did not answer within ${bound}ms` };
      return { up: false, said: lastLine(held.stderr) || lastLine(held.stdout) || `ssh exited ${held.code}` };
    },

    how: (asked) => ({
      command: program.command ?? 'ssh',
      // A caller's `cwd` is a path on this host and is left out: the box's
      // own `workdir` is what a command starts in.
      args: [...(program.args ?? []), ...argv(remote([asked.command, ...(asked.args ?? [])], asked.env))],
      // The box's own variables, its agent's socket among them, for the
      // `ssh` this host spawns.
      ...(target.env === undefined ? {} : { env: target.env }),
    }),

    exec: async (command, env) => {
      const held = await ran(program, argv(remote(command, env)), bound);
      // Not tolerated and not thrown: a command that failed is the tool
      // working, and its exit code is what the caller asked for.
      return { output: `${held.stdout}${held.stderr}`.trim(), code: held.code };
    },

    ran: (command, input) => ran(program, argv(remote(command)), TRANSFER_MS, input),

    pour: (command, path) => poured(program, argv(remote(command)), TRANSFER_MS, path),

    /**
     * What the box itself is using, read from its own `/proc`.
     *
     * One command that prints the box's first `/proc/stat` line, then that line
     * again half a second later, then `/proc/meminfo` and the core count. The
     * percentages are worked out here rather than there, so a box with an `awk`
     * of its own is not needed and what is parsed is the same text everywhere.
     */
    stats: async () => {
      const held = await ran(program, argv(STATS.probe), bound);
      // A box with no `/proc` - a FreeBSD box is the one this is written for -
      // answers a command that failed, and a gauge drawn from nothing is worse
      // than one that is not drawn.
      if (held.code !== 0) return undefined;
      return statsFrom(held.stdout);
    },

    /*
     * What the box can run, from the server check sent to its `sh`.
     *
     * The box's own `sh` rather than its login shell, so the script reads the
     * same whatever shell the account logs in with. A box that names the
     * command its host starts with is sent the command that says so. A box
     * that does not answer, or whose `sh` failed, is a sentence naming it,
     * because a report of nothing would read as a box that has nothing.
     */
    check: async (id) => checkServer(async () => {
      const command = target.host === undefined ? SERVER_CHECK.command : SERVER_CHECK.named;
      const held = await ran(program, argv(command), bound + CHECK_MARGIN_MS, SERVER_CHECK.script);
      if (held.timedOut) throw new Error(`${id} did not answer the server check within ${bound + CHECK_MARGIN_MS}ms`);
      if (held.code !== 0) {
        throw new Error(`${id} did not answer the server check: ${lastLine(held.stderr) || lastLine(held.stdout) || `ssh exited ${held.code}`}`);
      }
      return held.stdout;
    }),
  };
};

/**
 * Machines, on boxes reached over `ssh`.
 *
 * Every verb is one run of the `ssh` program, and nothing here is remembered
 * between two of them: a box can be reached from anywhere this host's ssh
 * can, so a listing is the only thing that says whether it is up right now.
 * The boxes are read again on every call, so one made or forgotten is listed
 * or gone at the next one.
 */
export const sshRuntime = (options: SshOptions): ComputerRuntime => {
  const boxes = options.boxes;

  /** One box's record, or a sentence naming the ones this host has instead. */
  const must = (name: string): SshBox => {
    const records = boxes.records();
    const held = records[name];
    if (held === undefined) {
      const known = Object.keys(records);
      throw new Error(`there is no ssh machine called ${name}${known.length === 0 ? '' : `; this host has ${known.join(', ')}`}`);
    }
    return held;
  };

  /** A box's login and record as one target, or the sentence that says why it cannot be reached. */
  const targetOf = async (box: SshBox): Promise<SshTarget | string> => {
    const login = await boxes.login(box.connector);
    if (typeof login === 'string') return login;
    return {
      ...login,
      ...(box.workdir === undefined ? {} : { workdir: box.workdir }),
      ...(box.host === undefined ? {} : { host: box.host }),
      ...(box.agents === undefined ? {} : { agents: box.agents }),
    };
  };

  /** The reach of a box that `must` found, or the sentence thrown when its login is not usable. */
  const reachOf = async (name: string): Promise<SshReach> => {
    const target = await targetOf(must(name));
    if (typeof target === 'string') throw new Error(`${name} cannot be reached: ${target}`);
    return sshReach(options, target);
  };

  /** The reach of a box, or nothing when it is not a box or its login is not usable. */
  const reachIf = async (name: string): Promise<SshReach | undefined> => {
    const box = boxes.records()[name];
    if (box === undefined) return undefined;
    const target = await targetOf(box);
    return typeof target === 'string' ? undefined : sshReach(options, target);
  };

  /**
   * One machine's record, which is what its create said and nothing else.
   *
   * A box carries no label of ours, no image of ours and no moment this host
   * saw it made, so what this host knows about it is its record. Nothing of the
   * login is here: a destination and a key are the connector's, and a reader
   * of a machine is not a reader of the connector it is reached with.
   *
   * Nothing here reaches the box: a record that cost one `ssh` would make every
   * listing pay a second reach per box, and what a caller wants to know about a
   * box that is up is `state`, which does reach it.
   */
  const recordOf = (name: string, box: SshBox): Record<string, unknown> => ({
    id: name,
    connector: box.connector,
    ...(box.workdir === undefined ? {} : { workdir: box.workdir }),
    ...(box.host === undefined ? {} : { host: box.host }),
    ...(box.agents === undefined ? {} : { agents: box.agents }),
  });

  /*
   * The command a box's sessions start their host with: the install of this
   * host's that one script on the box makes or finds (`hostinstall.ts`), its
   * folder checked to be one, given its own plugin root. Two sessions starting
   * on one box at once wait for one install, as two VMs on one server wait for
   * one template. A box that could not download it and has no other install
   * that runs is sent the files, and the same script installs from them.
   */
  const installing = new Map<string, Promise<string[]>>();
  const installedOn = async (name: string): Promise<string[]> => {
    const held = installing.get(name);
    if (held !== undefined) return held;
    const made = (async () => {
      const install = hostInstallOf(options.parts, options.lock);
      const reach = await reachOf(name);
      const run = async () => {
        const ran = await reach.ran([...HOST_INSTALL_COMMAND, ...install.args], Buffer.from(install.script));
        if (ran.timedOut) throw new Error(`ahpd ${install.version} was not installed on ${name} within ${TRANSFER_MS}ms`);
        const said = new Map(ran.stdout.split('\n').filter((line) => line.includes('='))
          .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
        return { code: ran.code, said, why: lastLine(ran.stderr) || lastLine(ran.stdout) || `ssh exited ${ran.code}` };
      };
      let { code, said, why } = await run();
      // A box that names its platform got as far as its download. One that
      // names none was refused before it, or not reached, and a copy is no help.
      const platform = said.get('platform');
      if (code !== 0 && platform !== undefined) {
        options.log?.(`ahpd ${install.version} was not installed on ${name}, so this host sends it the files: ${why}`, 'warn');
        try {
          const sent = await reach.ran(copyCommand(install), tarOf(await copyFolder(install, platform, options.copy)));
          if (sent.timedOut) throw new Error(`the files were not sent within ${TRANSFER_MS}ms`);
          if (sent.code !== 0) throw new Error(lastLine(sent.stderr) || `ssh exited ${sent.code}`);
          const first = why;
          ({ code, said, why } = await run());
          if (code !== 0) why = `${first}; and not from this host's files: ${why}`;
        }
        catch (error) {
          throw new Error(`ahpd ${install.version} was not installed on ${name}: ${why}; and this host could not send its files: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (code !== 0) throw new Error(`ahpd ${install.version} was not installed on ${name}: ${why}`);
      const dir = said.get('install') ?? '';
      if (!isHostInstall(dir, said.get('root') ?? '')) {
        throw new Error(`ahpd ${install.version} was not installed on ${name}: the box answered ${JSON.stringify(dir)}, which is not one of this host's installs`);
      }
      const host = `${dir}/bin/ahpd`;
      if (said.has('installed')) options.log?.(`ahpd ${install.version} was installed on ${name} at ${host}`);
      // VS Code's warning when its pinned CLI was not installed and another one
      // runs, which is the install's own last line.
      if (said.has('fallback')) options.log?.(`ahpd ${install.version} was not installed on ${name}, so ${host} there starts its sessions' host: ${why}`, 'warn');
      return ['env', `AHPD_PLUGIN_ROOT=${dir}/ahpd/plugins`, host];
    })();
    installing.set(name, made);
    try {
      return await made;
    }
    finally {
      installing.delete(name);
    }
  };

  return {
    kind: 'ssh',

    // A box is another host: a command run here cannot reach an agent there,
    // so every backend of a session in one runs nested.
    remote: true,

    // A command over ssh is one string the box's shell runs, variables and all.
    envInCommand: true,

    /*
     * One row per box, each asked in parallel.
     *
     * `running` is what `isRunning` reads as up, and the reason a box that did
     * not answer is not `unreachable` alone is that the line after it is the
     * only thing that says which box went and why. A box whose login is not
     * open is unreachable for that reason, with no `ssh` run.
     */
    list: async () => Promise.all(Object.entries(boxes.records()).map(async ([name, box]): Promise<Machine> => {
      const target = await targetOf(box);
      const held = typeof target === 'string' ? { up: false, said: target } : await sshReach(options, target).reached();
      return {
        id: name,
        // Not made from anything here: a box is set up by hand, so there is no
        // image of this host's to name.
        image: '',
        status: held.up ? RUNNING : `unreachable: ${held.said}`,
        // Nor made at a moment this host saw.
        created: '',
      };
    })),

    inspect: async (id) => {
      const box = boxes.records()[id];
      return box === undefined ? undefined : recordOf(id, box);
    },

    /*
     * What the box is doing, from one bounded reach.
     *
     * Nothing here remembers whether a box was up - it can be reached from
     * anywhere this host's ssh can - so the only answer is the one `ssh` gives
     * now: `running` for a box that answered, `stopped` for one that did not
     * or whose login is not open. A box with no record is not a machine, which
     * is `undefined`.
     */
    state: async (id) => {
      const box = boxes.records()[id];
      if (box === undefined) return undefined;
      const reach = await reachIf(id);
      if (reach === undefined) return 'stopped';
      return (await reach.reached()).up ? RUNNING : 'stopped';
    },

    /*
     * The agents the box was made for.
     *
     * On the box there is no label to read, so this is its record's own list: a
     * box prepared for nobody answers an empty list, and every agent may run in
     * it.
     */
    agents: async (id) => {
      const box = boxes.records()[id];
      return box === undefined ? undefined : box.agents ?? [];
    },

    /*
     * No parts: they are images mounted when a machine is made, and a box is
     * set up by hand. Its ahpd is the one this host installs there, with the
     * ahpd part's own plugins, or the one `host` starts, and its agents are its
     * own, so there is nothing for an agent's part need to be checked against.
     */
    parts: async () => undefined,

    /* Whoever made the box into a computer, as its record says. */
    owner: async (id) => {
      const box = boxes.records()[id];
      if (box === undefined) return undefined;
      return {
        ...(box.owner === undefined ? {} : { owner: box.owner }),
        ...(box.team === undefined ? {} : { team: box.team }),
        ...(box.project === undefined ? {} : { project: box.project }),
      };
    },

    /*
     * A command on the box, with its directory and its variables written into
     * the remote string - `ssh` has no `-w` and no `-e` to give them to.
     */
    how: async (id, asked) => (await reachIf(id))?.how(asked) satisfies Spawn | undefined,

    /** How this box starts a nested host: the command its record names, or the ahpd this host installs there. */
    hostCommand: async (id) => {
      const box = boxes.records()[id];
      if (box === undefined) return undefined;
      return box.host ?? installedOn(id);
    },

    /*
     * A create makes nothing on the box: it records the box, and which login
     * reaches it, once that login has reached it. A remove forgets the record
     * and runs nothing there.
     */
    run: async (spec) => {
      if (spec.ssh === undefined) throw new Error(`${spec.name}: a create on ssh names the connector the box is reached with`);
      if (boxes.records()[spec.name] !== undefined) throw new Error(`${spec.name} is already a computer; remove it or choose another name`);
      await boxes.add(spec.name, {
        ...spec.ssh,
        ...(spec.owner === undefined ? {} : { owner: spec.owner }),
        ...(spec.team === undefined ? {} : { team: spec.team }),
        ...(spec.project === undefined ? {} : { project: spec.project }),
      });
      return { id: spec.name, image: '', status: RUNNING, created: new Date().toISOString() };
    },
    start: async (id) => { must(id); throw madeElsewhere(id); },
    stop: async (id) => { must(id); throw madeElsewhere(id); },
    restart: async (id) => { must(id); throw madeElsewhere(id); },
    remove: async (id) => { must(id); boxes.forget(id); },

    exec: async (id, command, env): Promise<ExecResult> => (await reachOf(id)).exec(command, env),

    /*
     * A file written onto the box is not a thing this host does.
     *
     * What reaches these two verbs is a session's attachments, which live at a
     * path this host made - there is no such path on the box, and copying one
     * there is a second decision rather than a detail of this one.
     */
    putIn: async (id, paths) => {
      must(id);
      throw new Error(`${id} is a box this host reaches over ssh, and ${paths.length === 1 ? 'a file is' : 'files are'} not written onto it`);
    },
    takeOut: async (id, paths) => {
      must(id);
      throw new Error(`${id} is a box this host reaches over ssh, and ${paths.length === 1 ? 'a file is' : 'files are'} not removed from it`);
    },
    copyOut: async (id) => {
      must(id);
      throw new Error(`${id} is a box this host reaches over ssh, and files are not read out of it`);
    },

    /*
     * The two git verbs, which a box has nothing of.
     *
     * `fetch` is how a machine this host made brings its commits back, and a
     * box was not made here: it has no git directory of this host's and no
     * volume of ours. Nothing to bring back and nothing to hand over.
     */
    bringBack: async () => undefined,
    follow: async () => {},

    stats: async (id) => (await reachIf(id))?.stats(),

    check: async (id) => {
      if (boxes.records()[id] === undefined) return undefined;
      return (await reachOf(id)).check(id);
    },
    checks: (id) => boxes.records()[id] !== undefined,

    capabilities: () => CAPABILITIES,

    /*
     * Images are this host's own, and a box is not: a part is pulled or built
     * on a runtime that makes machines, so no image verb has anything to do here.
     */
    hasImage: async () => false,
    buildImage: async () => { throw new Error('an image is not built for a box this host reaches over ssh'); },
    pullImage: async () => { throw new Error('an image is not pulled for a box this host reaches over ssh'); },
    removeImage: async () => { throw new Error('an image is not removed for a box this host reaches over ssh'); },
    imagesOf: async () => [],
    checkPart: async () => 'a part is not checked for a box this host reaches over ssh',
  };
};

/** The marks the probe's three answers are told apart by. */
const CPU_MARK = '<<cpu>>';
const MEM_MARK = '<<mem>>';
const CORES_MARK = '<<cores>>';

/**
 * The one remote command `stats` runs.
 *
 * `head -n 1` rather than the whole file: the first line of `/proc/stat` is the
 * total across every core, which is what a box's own usage is, and the per-core
 * lines would be read and thrown away.
 */
const PROBE = [
  `printf '${CPU_MARK}\\n'`, 'head -n 1 /proc/stat',
  'sleep 0.5',
  `printf '${CPU_MARK}\\n'`, 'head -n 1 /proc/stat',
  `printf '${MEM_MARK}\\n'`, 'cat /proc/meminfo',
  `printf '${CORES_MARK}\\n'`, 'nproc',
].join('; ');

/**
 * The command `stats` runs, and the marks its answer is read back by.
 *
 * A command string and a parse are one format written in two places, so both
 * are here: what a caller needs to know about the shape is what `statsFrom`
 * reads, and a test that fixes the text a box answered writes the same marks
 * the probe prints.
 */
export const STATS = {
  probe: PROBE,
  marks: { cpu: CPU_MARK, mem: MEM_MARK, cores: CORES_MARK },
} as const;

/** The three marks, in the order the probe prints them. */
const MARKS = [CPU_MARK, MEM_MARK, CORES_MARK];

/**
 * What the box printed under one mark, once per time the probe printed it.
 *
 * A list rather than one string, because the cpu mark is printed twice: the two
 * readings are what a usage percentage is a difference between, and a parse
 * that read only the first would have nothing to subtract from.
 */
const printed = (said: string, mark: string): string[] => {
  const found: string[] = [];
  let at = said.indexOf(mark);
  while (at !== -1) {
    const from = at + mark.length;
    const next = MARKS.map((one) => said.indexOf(one, from)).filter((one) => one !== -1);
    const to = next.length === 0 ? said.length : Math.min(...next);
    found.push(said.slice(from, to).replace(/^\n+/, ''));
    at = said.indexOf(mark, to);
  }
  return found;
};

/** One field of a `/proc` line, as a number, or nothing when it is not one. */
const number = (value: string | undefined): number | undefined => {
  const held = Number(value);
  return value === undefined || value.trim() === '' || !Number.isFinite(held) ? undefined : held;
};

/**
 * The total and idle jiffies of one `/proc/stat` first line.
 *
 * `user nice system idle iowait irq softirq steal` and the two guest columns,
 * which are already counted in `user` and `nice` and so are not added again.
 * Idle is `idle` plus `iowait`, which is time the box had nothing to do.
 */
const jiffies = (line: string): { total: number; idle: number } | undefined => {
  const fields = line.trim().split(/\s+/);
  if (fields[0] !== 'cpu') return undefined;
  const numbers = fields.slice(1).map((one) => Number(one));
  if (numbers.length < 4 || numbers.some((one) => !Number.isFinite(one))) return undefined;
  const [user, nice, system, idle, iowait, irq, softirq, steal] = numbers;
  const busy = (user ?? 0) + (nice ?? 0) + (system ?? 0) + (irq ?? 0) + (softirq ?? 0) + (steal ?? 0);
  return { total: busy + (idle ?? 0) + (iowait ?? 0), idle: (idle ?? 0) + (iowait ?? 0) };
};

/**
 * What a box is using, read from the text its own `/proc` answered.
 *
 * Every number is a difference between two readings or a sum of one, so a box
 * that answered nothing usable is `undefined` rather than zeroes: a dial
 * reading zero says idle, which is not the same as a box this host could not
 * read.
 */
export const statsFrom = (said: string): MachineStats | undefined => {
  const readings = printed(said, CPU_MARK);
  const first = jiffies(readings[0]?.split('\n')[0] ?? '');
  const second = jiffies(readings[1]?.split('\n')[0] ?? '');
  if (second === undefined) return undefined;
  const total = first === undefined ? 0 : second.total - first.total;
  const idle = first === undefined ? 0 : second.idle - first.idle;
  const percent = total <= 0 ? 0 : Math.min(100, Math.max(0, (1 - idle / total) * 100));

  const memory = new Map<string, number>();
  for (const line of (printed(said, MEM_MARK)[0] ?? '').split('\n')) {
    const [key, value] = line.split(':');
    if (key === undefined || value === undefined) continue;
    const held = number(value.trim().split(/\s+/)[0]);
    if (held !== undefined) memory.set(key.trim(), held * 1024);
  }
  const limit = memory.get('MemTotal');
  if (limit === undefined) return undefined;
  // `MemAvailable` is the kernel's own answer and is absent on older ones,
  // where free plus the reclaimable cache is the same number.
  const available = memory.get('MemAvailable')
    ?? (memory.get('MemFree') ?? 0) + (memory.get('Buffers') ?? 0) + (memory.get('Cached') ?? 0);
  const used = Math.max(0, limit - available);
  const cores = number((printed(said, CORES_MARK)[0] ?? '').trim().split('\n')[0]);

  return {
    cpu: { percent, ...(cores === undefined || cores <= 0 ? {} : { cores }) },
    memory: {
      used,
      limit,
      percent: limit <= 0 ? 0 : (used / limit) * 100,
    },
  };
};
