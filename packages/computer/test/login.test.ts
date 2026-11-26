import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { clearFolder } from '../../../tools/holders.ts';
import { posix } from '../../../tools/posix.ts';
import { aliasOf, fingerprintOf, resultOf, sshLogins } from '../src/login.js';
import type { LoginOptions } from '../src/login.js';
import { sshReach } from '../src/ssh.js';
import type { Connector } from '../../sdk/src/types/connectors.js';
import { WAIT_MS } from '../../../tools/wait.ts';

/*
 * The `ssh` adapter: what each way of logging in gives `ssh`, the agent a
 * vault key is held in, the host key a login pins, and what its check says.
 * The `ssh`, `ssh-agent` and `ssh-add` are scripted, so no key and no box is
 * needed.
 */

const SSH = fileURLToPath(new URL('./fixtures/ssh.mjs', import.meta.url));
const AGENT = fileURLToPath(new URL('./fixtures/ssh-agent.mjs', import.meta.url));
const ADD = fileURLToPath(new URL('./fixtures/ssh-add.mjs', import.meta.url));

/** A key in the form `ssh-add` reads, which the scripted one only records. */
const KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----';
/** A host key line's key, as `ssh-keyscan` prints it after the host. */
const HOST_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl';

let dir: string | undefined;
const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  delete process.env.SSH_AGENT_FAKE_LOG;
  delete process.env.SSH_ADD_FAKE_FAIL;
  if (dir !== undefined) clearFolder(dir);
  dir = undefined;
});

/** A folder this test owns. */
const temp = (): string => (dir ??= mkdtempSync(join(tmpdir(), 'ahpd-login-')));

/** The adapter over the scripted programs, with the options given. */
const logins = (more: Partial<LoginOptions> = {}) => sshLogins({
  folder: join(temp(), 'logins'),
  program: { command: process.execPath, args: [SSH], env: { SSH_FAKE_LOG: join(temp(), 'ssh.jsonl') } },
  agent: [process.execPath, AGENT],
  add: [process.execPath, ADD],
  ...more,
});

/** One connector of the adapter, as the host hands it to `open`. */
const connector = (id: string, config: Record<string, unknown>, owner: Connector['owner'] = 'host'): Connector =>
  ({ id, adapter: 'ssh', owner, config });

/** Open one, and stop it after the test. */
const opened = (made: ReturnType<typeof logins>, one: Connector): void => {
  const stop = made.adapter.open(one);
  if (typeof stop === 'function') stops.push(() => { void stop(); });
};

/** What the scripted agent and `ssh-add` wrote. */
const agentLog = (): { event: string; socket: string; key?: string }[] => {
  const file = process.env.SSH_AGENT_FAKE_LOG;
  if (file === undefined || !existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as { event: string; socket: string; key?: string });
};

/** Wait for a condition, by the clock. */
const until = async (check: () => boolean): Promise<void> => {
  const end = performance.now() + WAIT_MS;
  while (!check()) {
    if (performance.now() > end) throw new Error(`still waiting after ${WAIT_MS} ms`);
    await new Promise((done) => { setTimeout(done, 10); });
  }
};

it('is the ssh adapter, with a secret key field and a destination required', () => {
  const { adapter } = logins();
  expect(adapter.name).toBe('ssh');
  const properties = adapter.schema.properties as Record<string, Record<string, unknown>>;
  expect(properties.key?.secret).toBe(true);
  expect(properties.auth?.enum).toEqual(['agent', 'file', 'vault']);
  expect(adapter.schema.required).toEqual(['destination']);
});

it('refuses a login it cannot use, by the field it lacks', () => {
  const { adapter } = logins();
  expect(() => adapter.open(connector('a', {}))).toThrow(/needs a destination/);
  expect(() => adapter.open(connector('b', { destination: 'dev02', auth: 'file' }))).toThrow(/names the file in identity/);
  expect(() => adapter.open(connector('c', { destination: 'dev02', auth: 'vault' }))).toThrow(/needs the key/);
  expect(() => adapter.open(connector('d', { destination: 'dev02', auth: 'password' }))).toThrow(/auth is agent, file or vault/);
});

it('refuses a value ssh would read as an option of its own, a port that is not one, and a host key that is not one line', () => {
  const { adapter } = logins();
  expect(() => adapter.open(connector('a', { destination: '-oProxyCommand=touch /tmp/pwned' }))).toThrow(/destination is one word that does not start with -/);
  expect(() => adapter.open(connector('b', { destination: 'dev02 -oProxyCommand=x' }))).toThrow(/destination is one word/);
  expect(() => adapter.open(connector('c', { destination: 'dev02', jump: '-oProxyCommand=x' }))).toThrow(/jump host is one word/);
  expect(() => adapter.open(connector('d', { destination: 'dev02', port: '22 -v' }))).toThrow(/port is a number from 1 to 65535/);
  expect(() => adapter.open(connector('e', { destination: 'dev02', port: '70000' }))).toThrow(/port is a number from 1 to 65535/);
  expect(() => adapter.open(connector('f', { destination: 'dev02', hostKey: `${HOST_KEY}\n@cert-authority * ${HOST_KEY}` }))).toThrow(/hostKey is one public key line/);
});

it('on a host with users, keeps a person\'s and a team\'s login to a key in the vault', () => {
  const { adapter } = logins({ hasUsers: true });
  expect(() => adapter.open(connector('a', { destination: 'dev02' }, 'user:ana'))).toThrow(/keeps its key in the vault; agent logs in with the daemon user's own keys/);
  expect(() => adapter.open(connector('b', { destination: 'dev02', auth: 'file', identity: '/home/ahpd/.ssh/id_ed25519' }, 'team:ops'))).toThrow(/file logs in with the daemon user's own keys/);
  // The host's own login may use the daemon user's ssh.
  expect(() => adapter.open(connector('c', { destination: 'dev02' }))).not.toThrow();
});

it('refuses a vault key on a host that cannot start an agent of its own, naming the setting', () => {
  const { adapter } = logins({ platform: 'win32' });
  expect(() => adapter.open(connector('dev02', { destination: 'dev02', auth: 'vault', key: KEY })))
    .toThrow(/set the computer plugin's ssh.vaultKey to file/);
});

it('reaches a box with the daemon user\'s own ssh, its host key kept under the login\'s name', () => {
  const made = logins();
  opened(made, connector('dev02', { destination: 'me@dev02', port: 2229 }));
  const login = made.logins.get('dev02');
  expect(login?.auth).toBe('agent');
  expect(login?.target.identity).toBeUndefined();
  expect(login?.target.agentSocket).toBeUndefined();
  const argv = sshReach({}, login!.target).argv('true');
  expect(argv).toEqual([
    '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=30',
    '-o', 'StrictHostKeyChecking=accept-new', '-o', `UserKnownHostsFile=${join(temp(), 'logins', 'dev02', 'known_hosts')}`, '-o', 'HashKnownHosts=no',
    '-o', `HostKeyAlias=${aliasOf('dev02')}`,
    '-p', '2229',
    'me@dev02', '--', 'true',
  ]);
});

it('offers a key file to its own box alone', () => {
  const made = logins();
  opened(made, connector('dev02', { destination: 'dev02', auth: 'file', identity: '/keys/dev02' }));
  const argv = sshReach({}, made.logins.get('dev02')!.target).argv('true');
  expect(argv.join(' ')).toContain('-i /keys/dev02 -o IdentitiesOnly=yes dev02');
});

it.skipIf(!posix)('holds a vault key in an agent of its own, one agent per login, stopped when the login closes', async () => {
  process.env.SSH_AGENT_FAKE_LOG = join(temp(), 'agent.jsonl');
  const made = logins();
  const closeA = made.adapter.open(connector('a', { destination: 'a.example.com', auth: 'vault', key: KEY }));
  opened(made, connector('b', { destination: 'b.example.com', auth: 'vault', key: KEY }));
  const a = made.logins.get('a');
  const b = made.logins.get('b');
  await a?.ready;
  await b?.ready;

  // Each login reaches its box with its own agent and nothing else.
  expect(a?.target.agentSocket).toBeDefined();
  expect(a?.target.agentSocket).not.toBe(b?.target.agentSocket);
  expect(a?.target.env).toEqual({ SSH_AUTH_SOCK: a?.target.agentSocket });
  const argv = sshReach({}, a!.target).argv('true');
  expect(argv).toContain(`IdentityAgent=${a?.target.agentSocket as string}`);
  // Its one key is named by its public half, so no other key file is offered.
  const pub = join(temp(), 'logins', 'a', 'key.pub');
  expect(argv.join(' ')).toContain(`-i ${pub} -o IdentitiesOnly=yes`);
  expect(readFileSync(pub, 'utf8')).toMatch(/^ssh-ed25519 AAAA/);
  // The key went to that agent, on stdin, and is in no file the login keeps.
  const added = agentLog().filter((one) => one.event === 'added');
  expect(added.map((one) => one.socket).sort()).toEqual([a?.target.agentSocket, b?.target.agentSocket].sort());
  expect(added[0]?.key).toBe(`${KEY}\n`);
  expect(existsSync(join(temp(), 'logins', 'a', 'key'))).toBe(false);

  // Closed, its agent stops and its socket goes; the other login keeps its own.
  if (typeof closeA === 'function') await closeA();
  expect(made.logins.get('a')).toBeUndefined();
  await until(() => agentLog().some((one) => one.event === 'stopped' && one.socket === a?.target.agentSocket));
  expect(existsSync(a?.target.agentSocket as string)).toBe(false);
  expect(made.logins.get('b')).toBeDefined();
});

it.skipIf(!posix)('says a login whose key the agent would not take is not usable', async () => {
  process.env.SSH_AGENT_FAKE_LOG = join(temp(), 'agent.jsonl');
  process.env.SSH_ADD_FAKE_FAIL = '1';
  const made = logins();
  opened(made, connector('dev02', { destination: 'dev02', auth: 'vault', key: 'not a key' }));
  await expect(made.logins.get('dev02')?.ready).rejects.toThrow(/its key was not loaded into its agent: Error loading key/);
  expect(await made.adapter.check?.(connector('dev02', {}))).toEqual({
    result: 'failed',
    message: 'its key was not loaded into its agent: Error loading key "(stdin)": invalid format',
  });
});

it('writes a vault key to a file only the daemon user reads, under ssh.vaultKey: file, and removes it at close', async () => {
  const made = logins({ vaultKey: 'file' });
  const close = made.adapter.open(connector('dev02', { destination: 'dev02', auth: 'vault', key: KEY }));
  const login = made.logins.get('dev02');
  const file = join(temp(), 'logins', 'dev02', 'key');
  expect(login?.target.identity).toBe(file);
  expect(readFileSync(file, 'utf8')).toBe(`${KEY}\n`);
  if (posix) expect(statSync(file).mode & 0o777).toBe(0o600);
  if (typeof close === 'function') await close();
  expect(existsSync(file)).toBe(false);
});

it('pins the host key a login names, so only that key is accepted', () => {
  const made = logins();
  opened(made, connector('dev02', { destination: 'dev02', hostKey: HOST_KEY }));
  expect(readFileSync(join(temp(), 'logins', 'dev02', 'known_hosts'), 'utf8')).toBe(`${aliasOf('dev02')} ${HOST_KEY}\n`);
});

it.skipIf(!posix)('checks a login with one ssh, and answers the host key it holds', async () => {
  const made = logins();
  opened(made, connector('dev02', { destination: 'dev02', hostKey: HOST_KEY }));
  const checked = await made.adapter.check?.(connector('dev02', {}));
  expect(checked?.result).toBe('ok');
  expect(checked?.message).toBe(`dev02 answered, host key ${fingerprintOf(HOST_KEY) as string}`);
  expect(checked?.message).toMatch(/SHA256:[A-Za-z0-9+/]{43}$/);
});

it.skipIf(!posix)('says a box that did not answer is unreachable, in ssh\'s own words', async () => {
  const made = logins({ program: { command: process.execPath, args: [SSH], env: { SSH_FAKE_LOG: join(temp(), 'ssh.jsonl'), SSH_FAKE_UNREACHABLE: 'dev02' } } });
  opened(made, connector('dev02', { destination: 'dev02' }));
  expect(await made.adapter.check?.(connector('dev02', {}))).toEqual({
    result: 'unreachable',
    message: 'ssh: connect to host dev02 port 22: No route to host',
  });
});

it('reads what ssh said as the check result it is', () => {
  expect(resultOf('me@dev02: Permission denied (publickey).')).toBe('denied');
  expect(resultOf('ssh: connect to host dev02 port 22: Connection refused')).toBe('unreachable');
  expect(resultOf('it did not answer within 40000ms')).toBe('unreachable');
  expect(resultOf('@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@')).toBe('failed');
  expect(resultOf('Host key verification failed.')).toBe('failed');
  expect(resultOf('something else')).toBe('failed');
  expect(fingerprintOf('no key here')).toBeUndefined();
});
