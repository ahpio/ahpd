import { loggerOf } from '../src/log.js';
import { expect, it } from 'vitest';
import { foldHostOptions, pluginHost } from '../src/plugins/plugins.js';
import { sdkVersion } from '../src/version.js';
import type { LoaderContext, ServedChannel } from '../src/types/plugin.js';

/*
 * A list in the reader's language: a todo plugin with a Portuguese catalog,
 * and a backup plugin that adds an export onto the list with one of its own.
 * The host's words for update and remove are its own catalogs'.
 */

const root = '/nonexistent-list-i18n';
const context = (): LoaderContext => ({ path: root, paths: [root], version: sdkVersion(), hostName: 'test', configDir: root, log: loggerOf(() => {}), say: () => {} });

function served() {
  const { host, contribution } = pluginHost('todos', context());
  host.registerList({ name: 'todo', channel: 'x-ahpd-todos', title: 'Todos' });
  host.registerKind({
    channel: 'x-ahpd-todos', name: 'todo', title: 'Todo', description: 'One thing to do.',
    schema: { type: 'object', properties: { title: { type: 'string' } } },
    operations: [{ id: 'complete', label: 'Done' }, { id: 'snooze', label: 'Snooze' }],
    rows: { list: () => [], read: () => undefined },
    invoke: () => undefined,
  });
  contribution.i18n = { pt: { kinds: { todo: { title: 'Tarefa', description: 'Uma coisa a fazer.' } }, operations: { complete: { label: 'Feito' } } } };
  const backup = pluginHost('backup', context());
  backup.host.registerOperation({ channel: 'x-ahpd-todos', operation: { id: 'export', label: 'Export' }, invoke: () => undefined });
  backup.contribution.i18n = { pt: { operations: { export: { label: 'Exportar' } } } };
  const folded = foldHostOptions({ path: root, agents: [] }, [contribution, backup.contribution]);
  expect(folded.problems).toEqual([]);
  return folded.options.channels!['x-ahpd-todos'] as ServedChannel;
}

type Entry = { title: string; description?: string; operations: { id: string; label?: string; confirmation?: string }[] };

it('reads a list\'s kinds and operations in Portuguese, and keeps English where no catalog has a word', () => {
  const channel = served().channel;
  const todo = (channel.kinds!('pt') as Record<string, Entry>)['todo']!;
  expect(todo.title).toBe('Tarefa');
  expect(todo.description).toBe('Uma coisa a fazer.');
  const label = (id: string) => todo.operations.find((one) => one.id === id);
  expect(label('todo/create')).toMatchObject({ label: 'Tarefa', description: 'Uma coisa a fazer.' });
  expect(label('todo/update')).toMatchObject({ label: 'Editar' });
  expect(label('todo/remove')).toMatchObject({ label: 'Remover', confirmation: 'Remover tarefa?' });
  expect(label('todo/complete')).toMatchObject({ label: 'Feito' });
  expect(label('todo/snooze')).toMatchObject({ label: 'Snooze' });
  expect(channel.listOperations!('pt')).toEqual([{ id: 'backup/export', label: 'Exportar', scopes: ['list'], grant: 'todo:put' }]);
});

it('reads English with no locale', () => {
  const channel = served().channel;
  const todo = (channel.kinds!() as Record<string, Entry>)['todo']!;
  expect(todo.title).toBe('Todo');
  expect(todo.operations.find((one) => one.id === 'todo/remove')).toMatchObject({ label: 'Remove', confirmation: 'Remove this todo?' });
});
