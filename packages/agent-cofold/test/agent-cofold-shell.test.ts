import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createFakeModel } from '@cofold/agents/testing';
import { DEFAULT_SHELL } from '@cofold/tools';
import type { AgentView, Bag, Engine, PluginHost, Session, Start } from '@ahpd/sdk';
import { cofoldAgent } from '../src/index.js';
import type { CofoldOptions, ShellSpec } from '../src/index.js';
import { assignmentsFor, shellFamilyOf, shellLanguageOf } from '../src/capabilities.js';
import { apply } from '../src/plugin.js';
import { startedNow } from '../../sdk/test/support/started.js';
import { WAIT_MS } from '../../../tools/wait.ts';
import { clearFolder } from '../../../tools/holders.ts';

/*
 * The program a shell call runs through, which code chooses and a
 * configuration does not, and the language and `env` syntax that follow it.
 */

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) clearFolder(folder);
});

/** Waits for `check` to hold, turning the event loop, and throws once `WAIT_MS` of wall-clock time has passed. */
const when = async (check: () => boolean): Promise<void> => {
  const until = Date.now() + WAIT_MS;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await new Promise((r) => { setTimeout(r, 0); });
  }
};

type Note = { channel: string; action: Bag };

const of = (notes: Note[], type: string): Bag[] =>
  notes.filter((one) => one.action.type === type).map((one) => one.action);

const ended = (notes: Note[]): boolean =>
  of(notes, 'chat/turnComplete').length + of(notes, 'chat/turnCancelled').length + of(notes, 'chat/error').length > 0;

/** A program that prints what it was given, and starts in a fraction of a second on every platform. */
const ECHOING: ShellSpec = { command: process.execPath, args: ['-e', 'process.stdout.write("ran: " + process.argv[1])'] };

const SHELL_CALL = [
  { toolCalls: [{ name: 'shell_exec', input: { command: 'echo hi' }, callId: 'c1' }] },
  { text: 'done' },
];

/** One session of `agent` in a folder of its own, with what it emitted. */
function open(agent: ReturnType<typeof cofoldAgent>, settings: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'ahpd-cofold-shell-'));
  folders.push(dir);
  const notes: Note[] = [];
  const session: Session = startedNow(agent.create({
    uri: 'ahp-session:/shell',
    chatUri: 'ahp-chat:/shell',
    settings: { ...agent.defaults(), ...settings },
    workingDirectory: dir,
    schema: () => agent.schema(),
    emit: (channel: string, action: Bag) => { notes.push({ channel, action }); },
  } as unknown as Start));
  return { session, notes };
}

it('names a shell\'s family by its program, with or without its folder and .exe', () => {
  expect(shellFamilyOf({ command: 'powershell.exe', args: [] })).toBe('powershell');
  expect(shellFamilyOf({ command: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', args: [] })).toBe('powershell');
  expect(shellFamilyOf({ command: 'pwsh', args: [] })).toBe('powershell');
  expect(shellFamilyOf({ command: '/bin/sh', args: [] })).toBe('bash');
  expect(shellFamilyOf({ command: 'bash', args: [] })).toBe('bash');
  expect(shellFamilyOf({ command: 'CMD.EXE', args: [] })).toBe('cmd');
  expect(shellFamilyOf({ command: 'node', args: [] })).toBeUndefined();
  // cofold's own shell when none is named.
  expect(shellFamilyOf()).toBe(process.platform === 'win32' ? 'powershell' : 'bash');
});

it('names a question\'s language for powershell and bash only', () => {
  expect(shellLanguageOf({ command: 'pwsh', args: [] })).toBe('powershell');
  expect(shellLanguageOf({ command: 'sh', args: [] })).toBe('bash');
  expect(shellLanguageOf({ command: 'cmd.exe', args: [] })).toBeUndefined();
  expect(shellLanguageOf(DEFAULT_SHELL)).toBe(shellLanguageOf());
});

it('writes the environment in the syntax of each family', () => {
  const env = { A: "it's" };
  expect(assignmentsFor(env, 'powershell')).toBe("$env:A='it''s';");
  expect(assignmentsFor(env, 'bash')).toBe("export A='it'\\''s';");
  expect(assignmentsFor(env, 'cmd')).toBe('set "A=it\'s" &&');
  // A program of no known family gets the POSIX syntax.
  expect(assignmentsFor(env, undefined)).toBe(assignmentsFor(env, 'bash'));
});

it('runs a shell call through the program code names, and names no language it does not know', async () => {
  const model = createFakeModel({ script: SHELL_CALL, stream: true });
  const options: CofoldOptions = { adapter: model, memory: true, shell: ECHOING };
  const { session, notes } = open(cofoldAgent(options), { permissionMode: 'default' });
  session.sendMessage('t1', 'run it');
  await when(() => of(notes, 'session/inputNeededSet').length > 0);

  const ready = of(notes, 'chat/toolCallReady').find((action) => action.toolCallId === 'c1');
  expect(ready).toMatchObject({ permissionKind: 'shell', shellCommand: 'echo hi' });
  expect(ready).not.toHaveProperty('shellLanguage');
  session.confirm('c1', true, 'allow-once');
  await when(() => ended(notes));

  const done = of(notes, 'chat/toolCallComplete').find((action) => action.toolCallId === 'c1');
  const said = (((done?.result as Bag).content as { text?: string }[]) ?? []).map((one) => one.text ?? '').join('');
  expect(said).toContain('ran: echo hi');
});

it('leaves out a shell the plugin\'s options name', async () => {
  let engine: Engine | undefined;
  const model = createFakeModel({ script: SHELL_CALL, stream: true });
  apply({ version: '1.2.3', registerEngine: (one: Engine) => { engine = one; } } as unknown as PluginHost, {
    adapter: model,
    memory: true,
    shell: ECHOING,
  });
  const record: AgentView = {
    id: 'local',
    engine: 'cofold',
    owner: 'host',
    name: 'Local',
    description: undefined,
    icon: undefined,
    model: undefined,
    config: {},
  };
  const agent = engine?.open(record) as ReturnType<typeof cofoldAgent>;
  const { session, notes } = open(agent, { permissionMode: 'default' });
  session.sendMessage('t1', 'run it');
  await when(() => of(notes, 'session/inputNeededSet').length > 0);

  // The question names the language of cofold's own shell, so the program the
  // options named never reached the session. The call is refused, so no
  // shell starts.
  const ready = of(notes, 'chat/toolCallReady').find((action) => action.toolCallId === 'c1');
  expect(ready).toMatchObject({ shellLanguage: shellLanguageOf() });
  session.confirm('c1', false);
  await when(() => ended(notes));
});
