/**
 * One list a plugin declared, served as a channel, and its rows as a scheme.
 *
 * The host keeps the list's structure - the joined declaration and its kinds -
 * and no row: a snapshot asks every kind that takes part for its rows, merges
 * them in the order asked, and adds each row's `kind` and `operations`. A row
 * reads alone at `<name>://<id>`, from the kind that answers it.
 *
 * A subscriber may watch the plain channel or a query of it, such as
 * `x-ahpd-todos://?done=false`. The channel keeps the ids it last sent to each
 * URI it served, so when a kind says a row changed the host reads that row
 * once, tests it against each watched query, and sends each URI `added`,
 * `changed` or `removed` as the row entered, stayed in or left it.
 *
 * Its operations are each kind's create, update and remove and the kind's own,
 * built by `kindOperations`. `x-ahpd/invokeOperation` checks the grant, the
 * target and the input against the schema; the channel hands the call to the
 * kind's `invoke` with the row it read.
 */

import { kindOffers, kindOperations } from '../kinds/operations.js';
import { HOST_CATALOGS, translated, type Catalogs } from '../i18n.js';
import type { ProcessesServing } from './processes.js';
import { absentResource, asFile } from '../resources/records.js';
import { INVALID_PARAMS, RpcError } from '../rpc.js';
import { reason } from '../utils/values.js';
import type { ChannelOperation, Operation, OperationStatus } from '../types/kinds.js';
import type { ListInstance, ListQuery, ListRow, ProcessLifecycle, ServedList, ServedListKind, ServedListOperation } from '../types/lists.js';
import { onTeam } from '../channels/owners.js';
import type { PluginChannel, ServedChannel } from '../types/plugin.js';
import type { Read, ResourceProvider } from '../types/resources.js';
import type { Grant, Principal } from '../types/users.js';

/** One row as a client reads it: the kind's row, with its kind, its operations and the call running on it. */
export interface ServedRow extends ListRow {
  kind: string;
  operations: string[];
  operation?: { id: string; status: OperationStatus; error?: string };
  /** For a row of a runtime kind, its current process and how it is going. */
  process?: { uri: string; lifecycle?: ProcessLifecycle };
}

/** What `listChannel` builds: the channel the fold serves, the scheme of one row, and how a later fold hands it the list again. */
export interface ListServing {
  served: ServedChannel;
  provider: ResourceProvider;
  /**
   * Serve the list as a later fold joined it, keeping the channel, the
   * provider and what each watched URI was sent: a host refuses a live fold
   * that moves a resource scheme, and a subscriber keeps its view.
   */
  update(list: ServedList): void;
  /** Stop each running row of a runtime kind, as the host closes. */
  close(): Promise<void>;
}

/** The query a list URI asks, checked against what the list declares. */
const queryOf = (list: ServedList, uri: string): ListQuery => {
  const at = uri.indexOf('?');
  const params = new URLSearchParams(at < 0 ? '' : uri.slice(at + 1));
  const query: ListQuery = { filters: {} };
  for (const [key, value] of params) {
    if (key === 'sort') {
      const field = value.startsWith('-') ? value.slice(1) : value;
      if (!(list.sorts ?? []).includes(field)) throw new RpcError(INVALID_PARAMS, `${list.channel}:// sorts by ${(list.sorts ?? []).join(', ') || 'nothing'}, not ${field}`);
      query.sort = value;
      continue;
    }
    if (key === 'instance') {
      if (list.instances !== true) throw new RpcError(INVALID_PARAMS, `${list.channel}:// has no instances`);
      query.instances = value.split(',').filter((one) => one !== '');
      continue;
    }
    if (key === 'search') {
      if ((list.search ?? []).length === 0) throw new RpcError(INVALID_PARAMS, `${list.channel}:// takes no search`);
      query.search = value;
      continue;
    }
    if (!(list.filters ?? []).some((one) => one.field === key)) {
      throw new RpcError(INVALID_PARAMS, `${list.channel}:// has no filter ${key}; it filters by ${(list.filters ?? []).map((one) => one.field).join(', ') || 'nothing'}`);
    }
    query.filters[key] = value.split(',').filter((one) => one !== '');
  }
  return query;
};

/** The fields a kind's schema marks `x-ahpd-live`, which what runs sets and no form writes. */
const liveFields = (kind: ServedListKind): string[] => {
  const properties = kind.schema['properties'];
  if (typeof properties !== 'object' || properties === null) return [];
  return Object.entries(properties as Record<string, unknown>)
    .filter(([, field]) => typeof field === 'object' && field !== null && (field as Record<string, unknown>)['x-ahpd-live'] === true)
    .map(([name]) => name);
};

/** The schema of one field of a kind, or nothing when the kind has no such field. */
const fieldOf = (kind: ServedListKind, field: string): Record<string, unknown> | undefined => {
  const properties = kind.schema['properties'];
  if (typeof properties !== 'object' || properties === null) return undefined;
  const held = (properties as Record<string, unknown>)[field];
  return typeof held === 'object' && held !== null ? held as Record<string, unknown> : undefined;
};

/** Whether a kind takes part in a query: it has each filter's field with the filter's type, a search field, and the field asked to sort by. */
const takesPart = (list: ServedList, kind: ServedListKind, query: ListQuery): boolean => {
  for (const field of Object.keys(query.filters)) {
    const schema = fieldOf(kind, field);
    const type = list.filters?.find((one) => one.field === field)?.type;
    if (schema === undefined) return false;
    if (type === 'enum' && !Array.isArray(schema['enum'])) return false;
    if (type === 'boolean' && schema['type'] !== 'boolean') return false;
  }
  if (query.search !== undefined && !(list.search ?? []).some((field) => fieldOf(kind, field) !== undefined)) return false;
  if (query.sort !== undefined && fieldOf(kind, query.sort.replace(/^-/, '')) === undefined) return false;
  return true;
};

/** Whether one row of a kind that takes part matches a query: each filter's values, and the search as text. */
const matches = (list: ServedList, row: ListRow, query: ListQuery): boolean => {
  if (query.instances !== undefined && query.instances.length > 0 && !query.instances.includes(row.instance ?? '')) return false;
  for (const [field, values] of Object.entries(query.filters)) {
    if (values.length === 0) continue;
    if (!values.includes(String(row.record[field]))) return false;
  }
  if (query.search !== undefined && query.search !== '') {
    const text = query.search.toLowerCase();
    const found = (list.search ?? []).some((field) => {
      const value = row.record[field];
      return value !== undefined && value !== null && String(value).toLowerCase().includes(text);
    });
    if (!found) return false;
  }
  return true;
};

/** Order two values of one field: numbers by size, anything else as text; a missing value goes last. */
const compare = (left: unknown, right: unknown): number => {
  if (left === undefined || left === null) return right === undefined || right === null ? 0 : 1;
  if (right === undefined || right === null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
};

/**
 * Serve one folded list: its channel, with the snapshot, the operations and
 * the live actions, and the scheme of one row.
 *
 * `onProblem` is told of a kind that throws while it answers rows, with the
 * plugin that registered it; its rows are left out and the others answered.
 */
export function listChannel(initial: ServedList, onProblem: (message: string) => void = () => {}, processes?: ProcessesServing): ListServing {
  let list = initial;
  const scheme = list.channel;
  const root = `${scheme}://`;
  const kinds = (): ServedListKind[] => Object.values(list.kinds);

  /** Say what a kind failed at, on its plugin's row and in the host's own report. */
  const warn = (kind: ServedListKind, line: string): void => {
    kind.problem?.(line);
    onProblem(`plugin ${kind.by}: ${line}`);
  };

  /** How a row is named in this list: `<instance>/<id>` in a list with instances, else its id. */
  const keyOf = (row: ListRow): string => (row.instance === undefined ? row.id : `${row.instance}/${row.id}`);
  /** The instance and the id a key names. */
  const partsOf = (key: string): { instance: string | undefined; id: string } => {
    if (list.instances !== true) return { instance: undefined, id: key };
    const at = key.indexOf('/');
    return at < 0 ? { instance: '', id: key } : { instance: key.slice(0, at), id: key.slice(at + 1) };
  };
  /**
   * Whether a reader may read an instance, by the rule connectors are read by:
   * their own, their teams', and the host's to anyone who reads the list. An
   * instance with no owner is read by whoever reads the list.
   */
  const mayRead = (instance: ListInstance | undefined, reader: Principal | undefined): boolean => {
    if (reader === undefined || instance?.owner === undefined || instance.owner === 'host') return true;
    if (instance.owner.startsWith('user:')) return reader.plugin === undefined && reader.id === instance.owner.slice('user:'.length);
    return onTeam(reader, instance.owner.slice('team:'.length));
  };
  /** The instances of a kind a reader may read, among those a query asks for; one entry with no instance in a list without them. */
  const instancesOf = (kind: ServedListKind, reader: Principal | undefined, asked?: string[]): (ListInstance | undefined)[] => {
    if (list.instances !== true) return [undefined];
    return [...(kind.instances?.values() ?? [])]
      .filter((one) => mayRead(one, reader))
      .filter((one) => asked === undefined || asked.length === 0 || asked.includes(one.id));
  };

  /** How the last call of an operation on the list as a whole went, by its id. */
  const listed = new Map<string, { status: OperationStatus; error?: string }>();
  /** The call running on a row, or the last one that ran, by the row's id. */
  const running = new Map<string, { id: string; status: OperationStatus; error?: string }>();
  /** The ids last sent to each URI a subscriber was answered at. */
  const shown = new Map<string, Set<string>>();

  /** The operations other plugins added onto a kind. */
  const addedOnto = (kind: ServedListKind): ServedListOperation[] => (list.operations ?? []).filter((one) => one.onto?.includes(kind.name) === true);
  /** The operations other plugins added onto the list as a whole. */
  const addedOnList = (): ServedListOperation[] => (list.operations ?? []).filter((one) => one.kinds === undefined);
  /** The current process of each running row of a runtime kind, by `<kind> <row>`. */
  const runs = new Map<string, string>();
  const runKey = (kind: ServedListKind, id: string): string => `${kind.name} ${id}`;
  /** Whether a row of a runtime kind runs now: it has a process that has not ended. */
  const runsNow = (kind: ServedListKind, id: string): boolean => {
    const uri = runs.get(runKey(kind, id));
    const lifecycle = uri === undefined ? undefined : processes?.lifecycleOf(uri);
    return lifecycle === 'pending' || lifecycle === 'running';
  };
  /** The start and stop a runtime kind offers, beside its own operations. */
  const RUNTIME_OPERATIONS = [
    { id: 'start', label: 'Start', icon: 'play' },
    { id: 'stop', label: 'Stop', icon: 'debug-stop' },
  ];
  /** A kind with the operations added onto it beside its own. */
  const withAdded = (kind: ServedListKind): ServedListKind => {
    const added = addedOnto(kind);
    const runtime = kind.class === 'runtime' ? RUNTIME_OPERATIONS : [];
    return added.length === 0 && runtime.length === 0 ? kind : { ...kind, operations: [...runtime, ...(kind.operations ?? []), ...added.map((one) => one.operation)] };
  };
  /** The operations one row offers now: a runtime row offers start when it does not run, and stop when it does. */
  const offersOf = (kind: ServedListKind, row: ListRow): string[] => {
    const ids = kindOffers(withAdded(kind), row.record, true);
    if (kind.class !== 'runtime') return ids;
    const drop = `${kind.name}/${runsNow(kind, keyOf(row)) ? 'start' : 'stop'}`;
    return ids.filter((one) => one !== drop);
  };

  const status = (id: string): { status: OperationStatus; error?: string } => listed.get(id) ?? { status: 'idle' };

  /** One operation added onto the list, as the list lists it. */
  const listOperation = (added: ServedListOperation): Operation => {
    const { operation } = added;
    const id = `${added.owner}/${operation.id}`;
    return {
      id,
      kind: added.owner,
      label: operation.label ?? operation.id,
      ...(operation.description === undefined ? {} : { description: operation.description }),
      ...(operation.icon === undefined ? {} : { icon: operation.icon }),
      ...(operation.input === undefined ? {} : { input: operation.input }),
      ...(operation.confirmation === undefined ? {} : { confirmation: operation.confirmation }),
      ...(operation.long === true ? { long: true } : {}),
      scopes: ['list'],
      grant: operation.grant ?? `${list.name}:put`,
      ...status(id),
    };
  };

  const operations = (): Operation[] => [
    ...kinds().flatMap((kind) => kindOperations(withAdded(kind), {
      subject: list.name,
      scope: list.name,
      status,
      update: true,
      words: { confirmation: `Remove this ${kind.title.toLowerCase()}?` },
    })),
    ...addedOnList().map(listOperation),
  ];

  /** One row as a client reads it. */
  const served = (kind: ServedListKind, row: ListRow): ServedRow => {
    const key = keyOf(row);
    const operation = running.get(key);
    const run = runs.get(runKey(kind, key));
    const lifecycle = run === undefined ? undefined : processes?.lifecycleOf(run);
    return {
      id: row.id,
      ...(row.instance === undefined ? {} : { instance: row.instance }),
      kind: kind.name,
      ...(row.owner === undefined ? {} : { owner: row.owner }),
      record: row.record,
      operations: offersOf(kind, row),
      ...(operation === undefined ? {} : { operation }),
      ...(kind.class === 'runtime' && run !== undefined ? { process: { uri: run, ...(lifecycle === undefined ? {} : { lifecycle }) } } : {}),
    };
  };

  /** Every row a query asks for, from each kind that takes part, merged in the order asked. */
  const rowsOf = async (query: ListQuery, reader: Principal | undefined): Promise<ServedRow[]> => {
    const asked = kinds().filter((kind) => takesPart(list, kind, query))
      .flatMap((kind) => instancesOf(kind, reader, query.instances).map((instance) => ({ kind, instance })));
    const answers = await Promise.all(asked.map(async ({ kind, instance }) => {
      try {
        return (await kind.rows.list(query, instance?.id, reader))
          .map((row) => served(kind, instance === undefined ? row : { ...row, instance: instance.id }));
      }
      catch (error) {
        warn(kind, `kind ${kind.name} could not list its rows of ${list.name}${instance === undefined ? '' : ` in ${instance.id}`}: ${reason(error)}`);
        return [];
      }
    }));
    const rows = answers.flat();
    const sort = query.sort ?? list.defaultSort;
    if (sort === undefined) return rows;
    const field = sort.replace(/^-/, '');
    const way = sort.startsWith('-') ? -1 : 1;
    return rows.sort((left, right) => way * compare(left.record[field], right.record[field]));
  };

  /**
   * The kind that holds a row, and the row with its instance, by the row's
   * key, asked of each kind in turn; nothing when none does, or when the
   * reader may not read its instance.
   */
  const find = async (key: string, reader: Principal | undefined): Promise<{ kind: ServedListKind; row: ListRow } | undefined> => {
    const { instance, id } = partsOf(key);
    for (const kind of kinds()) {
      const held = instance === undefined ? undefined : kind.instances?.get(instance);
      if (instance !== undefined && (held === undefined || !mayRead(held, reader))) continue;
      let row: ListRow | undefined;
      try { row = await kind.rows.read(id, instance, reader); }
      catch (error) {
        warn(kind, `kind ${kind.name} could not read ${list.name} ${key}: ${reason(error)}`);
        continue;
      }
      if (row !== undefined) return { kind, row: instance === undefined ? row : { ...row, instance } };
    }
    return undefined;
  };

  const servedChannel: ServedChannel = {
    by: list.by,
    scheme,
    channel: undefined as unknown as PluginChannel,
  };

  /** Send one action to every subscriber of one URI, or to those who may read its instance. */
  const send = (uri: string, action: { type: string } & Record<string, unknown>, instance?: ListInstance): void => {
    servedChannel.publish?.(uri, action, instance === undefined ? {} : { visible: (reader) => mayRead(instance, reader) });
  };

  /** The URIs a subscriber is on now; one nobody watches any more is forgotten. */
  const watched = (): string[] => {
    for (const uri of [...shown.keys()]) {
      if ((servedChannel.subscribers?.(uri) ?? []).length === 0) shown.delete(uri);
    }
    return [...shown.keys()];
  };

  /**
   * Read one row again and tell each watched URI what it means there: `added`
   * where it now belongs and was not sent, `changed` where it was, `removed`
   * where it was sent and no longer belongs or is gone.
   */
  const changed = async (key: string): Promise<void> => {
    const found = await find(key, undefined);
    const { instance, id } = partsOf(key);
    const held = instance === undefined ? undefined : found?.kind.instances?.get(instance);
    for (const uri of watched()) {
      const ids = shown.get(uri)!;
      let query: ListQuery;
      try { query = queryOf(list, uri); }
      catch { continue; }
      const belongs = found !== undefined && takesPart(list, found.kind, query) && matches(list, found.row, query);
      if (belongs) {
        const type = ids.has(key) ? 'changed' : 'added';
        ids.add(key);
        send(uri, { type: `${scheme}/${type}`, ...served(found.kind, found.row) }, held);
      }
      else if (ids.has(key)) {
        ids.delete(key);
        send(uri, { type: `${scheme}/removed`, id, ...(instance === undefined ? {} : { instance }) }, held);
      }
    }
  };

  /** The instances a reader may read, of every kind, as a snapshot lists them. */
  const instancesFor = (reader: Principal | undefined): { id: string; title: string; kind: string; owner?: string }[] =>
    list.instances !== true ? [] : kinds().flatMap((kind) => instancesOf(kind, reader).map((one) => ({ ...one!, kind: kind.name })));

  /**
   * An instance came or went: each watched URI is told the instances, and is
   * sent `added` for each row of an instance that came and belongs there, or
   * `removed` for each row it was sent of an instance that went.
   */
  const instanceMoved = async (kind: ServedListKind, id: string, present: boolean): Promise<void> => {
    const instance = kind.instances?.get(id);
    for (const uri of watched()) {
      const ids = shown.get(uri)!;
      // Each subscriber is told the instances they may read.
      for (const one of servedChannel.subscribers?.(uri) ?? []) {
        servedChannel.publish?.(uri, { type: `${scheme}/instances`, instances: instancesFor(one.reader) }, { to: one.client, visible: (reader) => reader?.id === one.reader?.id });
      }
      if (!present) {
        for (const key of [...ids]) {
          if (!key.startsWith(`${id}/`)) continue;
          ids.delete(key);
          send(uri, { type: `${scheme}/removed`, id: key.slice(id.length + 1), instance: id });
        }
        continue;
      }
      let query: ListQuery;
      try { query = queryOf(list, uri); }
      catch { continue; }
      if (instance === undefined || !takesPart(list, kind, query)) continue;
      if (query.instances !== undefined && query.instances.length > 0 && !query.instances.includes(id)) continue;
      let rows: ListRow[];
      try { rows = await kind.rows.list(query, id, undefined); }
      catch (error) {
        warn(kind, `kind ${kind.name} could not list its rows of ${list.name} in ${id}: ${reason(error)}`);
        continue;
      }
      for (const row of rows) {
        const key = `${id}/${row.id}`;
        ids.add(key);
        send(uri, { type: `${scheme}/added`, ...served(kind, { ...row, instance: id }) }, instance);
      }
    }
  };

  /** Tell each watched URI what the list's operations are now. */
  const publishOperations = (): void => {
    const action = { type: `${scheme}/operations`, operations: operations() };
    for (const uri of watched()) send(uri, action);
  };

  /** Point each kind's `changed` at this channel. */
  const wire = (): void => {
    for (const kind of kinds()) {
      kind.changed = (instance, id) => {
        const key = list.instances === true && instance !== undefined ? `${instance}/${id}` : id;
        void changed(key).catch((error: unknown) => { onProblem(`list ${list.name} could not send ${key}: ${reason(error)}`); });
      };
      kind.acceptsInstances = list.instances === true;
      kind.instancesChanged = (id, present) => {
        void instanceMoved(kind, id, present).catch((error: unknown) => { onProblem(`list ${list.name} could not send instance ${id}: ${reason(error)}`); });
      };
      kind.processChanged = (id) => { processes?.changed(list.channel, kind.name, id); };
    }
    for (const added of list.operations ?? []) {
      added.processChanged = (id) => { processes?.changed(list.channel, added.owner, id); };
    }
  };
  wire();

  /**
   * One operation in a reader's locale. A kind's create is its title and
   * description from its plugin's catalogs; update and remove are the host's
   * words at `operations.list`, with the kind's title in the question; a
   * kind's own operation and an added one are read at `operations.<id>` in
   * the catalogs of the plugin that wrote it. A word no catalog has stays
   * English.
   */
  const inLocale = (operation: Operation, locale: string | undefined, kind: ServedListKind | undefined, added: ServedListOperation | undefined): Operation => {
    if (locale === undefined) return operation;
    const name = operation.id.slice(operation.id.indexOf('/') + 1);
    const words = (path: readonly string[], catalogs: readonly (Catalogs | undefined)[]): Operation => ({
      ...operation,
      ...(operation.label === undefined ? {} : { label: translated([...path, 'label'], operation.label, locale, ...catalogs) }),
      ...(operation.description === undefined ? {} : { description: translated([...path, 'description'], operation.description, locale, ...catalogs) }),
      ...(operation.confirmation === undefined ? {} : { confirmation: translated([...path, 'confirmation'], operation.confirmation, locale, ...catalogs) }),
    });
    if (added !== undefined) return words(['operations', added.operation.id], [added.catalogs]);
    if (kind === undefined) return operation;
    const title = translated(['kinds', kind.name, 'title'], kind.title, locale, kind.catalogs);
    if (name === 'create') {
      const description = kind.description === undefined ? undefined : translated(['kinds', kind.name, 'description'], kind.description, locale, kind.catalogs);
      return { ...operation, label: title, ...(description === undefined ? {} : { description }) };
    }
    if (name === 'update' || name === 'remove') {
      const said = words(['operations', 'list', name], [HOST_CATALOGS]);
      if (name !== 'remove') return said;
      const question = translated(['operations', 'list', 'remove', 'confirmation'], 'Remove this {kind}?', locale, HOST_CATALOGS);
      return { ...said, confirmation: question.replace('{kind}', title.toLowerCase()) };
    }
    return words(['operations', name], [kind.catalogs]);
  };

  /**
   * What runs an operation id: a kind's own, an operation a plugin added onto
   * that kind, or one added onto the list, by the part before the slash.
   */
  const operationOf = (operation: ChannelOperation): { kind?: ServedListKind; added?: ServedListOperation; name: string } => {
    const at = operation.id.indexOf('/');
    const prefix = operation.id.slice(0, at);
    const name = operation.id.slice(at + 1);
    const kind = list.kinds[prefix];
    if (kind !== undefined) {
      const added = addedOnto(kind).find((one) => one.operation.id === name);
      return added === undefined ? { kind, name } : { kind, added, name };
    }
    const added = addedOnList().find((one) => one.owner === prefix && one.operation.id === name);
    if (added === undefined) throw new RpcError(INVALID_PARAMS, `No kind ${prefix} in list ${list.name}`);
    return { added, name };
  };

  const channel: PluginChannel = {
    grant: `${list.name}:get` as Grant,
    describe: () => ({ title: list.title, ...(list.description === undefined ? {} : { description: list.description }) }),
    listOperations: (locale) => addedOnList().map((added) => inLocale(listOperation(added), locale, undefined, added))
      .map(({ status: _status, error: _error, kind: _kind, offered: _offered, ...rest }) => rest),
    kinds: (locale) => Object.fromEntries(kinds().map((kind) => {
      const description = kind.description === undefined ? undefined : translated(['kinds', kind.name, 'description'], kind.description, locale, kind.catalogs);
      return [kind.name, {
        title: translated(['kinds', kind.name, 'title'], kind.title, locale, kind.catalogs),
        ...(description === undefined ? {} : { description }),
        ...(kind.icon === undefined ? {} : { icon: kind.icon }),
        schema: kind.schema,
        operations: operations().filter((one) => one.kind === kind.name)
          .map((one) => inLocale(one, locale, kind, addedOnto(kind).find((added) => `${kind.name}/${added.operation.id}` === one.id)))
          .map(({ status: _status, error: _error, kind: _kind, offered: _offered, ...rest }) => rest),
      }];
    })),
    snapshot: async (uri, reader) => {
      const query = queryOf(list, uri);
      const records = await rowsOf(query, reader);
      shown.set(uri, new Set(records.map((one) => keyOf(one))));
      return { records, ...(list.instances === true ? { instances: instancesFor(reader) } : {}), operations: operations().filter((one) => one.scopes.includes('list')).map(({ id, status, error }) => ({ id, status, ...(error === undefined ? {} : { error }) })) };
    },
    operations: {
      operations: () => operations(),
      offers: async (target, operationId, reader) => {
        const found = await find(target, reader);
        return found !== undefined && offersOf(found.kind, found.row).includes(operationId);
      },
      begin: (operationId, target) => {
        if (target === undefined) {
          listed.set(operationId, { status: 'running' });
          publishOperations();
          return;
        }
        running.set(target, { id: operationId, status: 'running' });
        void changed(target);
      },
      settle: (operationId, target, error) => {
        if (target === undefined) {
          listed.set(operationId, error === undefined ? { status: 'idle' } : { status: 'error', error });
          publishOperations();
          return;
        }
        running.set(target, { id: operationId, status: error === undefined ? 'idle' : 'error', ...(error === undefined ? {} : { error }) });
        void changed(target);
      },
      run: async (operation, target, input, reader) => {
        const { kind, added, name } = operationOf(operation);
        const found = target === undefined ? undefined : await find(target, reader);
        if (target !== undefined && found === undefined) throw absentResource(list.name, `${list.name}://${target}`);
        // An added operation runs the adding plugin's invoke, and its processes are that plugin's.
        if (added !== undefined) {
          if (added.operation.long === true && processes !== undefined) {
            return { process: processes.start(list, added.owner, async (work) => { await added.invoke(found?.row, input, work); }) };
          }
          await added.invoke(found?.row, input);
          if (target === undefined) return {};
          const after = await find(target, reader);
          return after === undefined ? {} : served(after.kind, after.row);
        }
        // A runtime row starts as a process, and stops by its abort and the kind's stop.
        if (kind!.class === 'runtime' && (name === 'start' || name === 'stop') && found !== undefined) {
          const rowKey = keyOf(found.row);
          const key = runKey(kind!, rowKey);
          if (name === 'start') {
            if (processes === undefined) throw new RpcError(INVALID_PARAMS, `${list.name} cannot run processes on this host`);
            const row = found.row;
            const uri = processes.start(list, kind!.name, async (work) => { await kind!.start!(row, work); }, () => { void changed(rowKey); });
            runs.set(key, uri);
            void changed(rowKey);
            return { process: uri };
          }
          const uri = runs.get(key);
          if (uri !== undefined) processes?.abort(uri);
          await kind!.stop!(found.row);
          void changed(rowKey);
          return {};
        }
        // A field the kind says is live is the process's to set, never a form's.
        if ((name === 'create' || name === 'update') && input !== undefined) {
          const live = liveFields(kind!).filter((field) => field in input);
          if (live.length > 0) throw new RpcError(INVALID_PARAMS, `${live.join(', ')} ${live.length === 1 ? 'is' : 'are'} live, set by what runs; a ${name} may not write ${live.length === 1 ? 'it' : 'them'}`);
        }
        // A long call answers with its process at once; its work runs in it.
        if (kind!.operations?.find((one) => one.id === name)?.long === true && processes !== undefined) {
          const process = processes.start(list, kind!.name, async (work) => { await kind!.invoke(name, found?.row, input, work); });
          return { process };
        }
        const made = await kind!.invoke(name, found?.row, input);
        // In an instance list a create answers its row as `<instance>/<id>`, as the row is named.
        const id = typeof made === 'string' && made !== '' ? made : target;
        if (id === undefined) return {};
        const after = await find(id, reader);
        return after === undefined ? {} : served(after.kind, after.row);
      },
    },
  };
  servedChannel.channel = channel;

  const provider: ResourceProvider = {
    describe: () => ({ title: list.title, ...(list.description === undefined ? {} : { description: list.description }) }),
    read: async (uri: string, _wanted?: string, reader?: Principal): Promise<Read> => {
      const key = uri.slice(`${list.name}://`.length).replace(/^\/+/, '');
      if (key === '' || (list.instances !== true && key.includes('/'))) throw absentResource(list.name, uri);
      const found = await find(key, reader);
      if (found === undefined) throw absentResource(list.name, uri);
      return asFile(JSON.stringify(served(found.kind, found.row), null, 2));
    },
  };

  const update = (next: ServedList): void => {
    list = next;
    servedChannel.by = next.by;
    wire();
  };

  const close = async (): Promise<void> => {
    for (const kind of kinds()) {
      if (kind.class !== 'runtime') continue;
      for (const [key, uri] of runs) {
        if (!key.startsWith(`${kind.name} `) || !runsNow(kind, key.slice(kind.name.length + 1))) continue;
        processes?.abort(uri);
        const row = await find(key.slice(kind.name.length + 1), undefined);
        if (row !== undefined) await Promise.resolve(kind.stop?.(row.row)).catch((error: unknown) => { warn(kind, `kind ${kind.name} could not stop ${row.row.id}: ${reason(error)}`); });
      }
    }
  };

  return { served: servedChannel, provider, update, close };
}

/** The lists served over one base, by name, kept from one fold to the next. */
const servings = new WeakMap<object, Map<string, ListServing>>();

/**
 * The list served for `list.name` over `base`: the one an earlier fold over
 * the same base built, handed the list again, or a new one. A list that moved
 * to another channel is a new one.
 */
export function servedList(base: object, list: ServedList, onProblem?: (message: string) => void, processes?: ProcessesServing): ListServing {
  let held = servings.get(base);
  if (held === undefined) {
    held = new Map();
    servings.set(base, held);
  }
  const before = held.get(list.name);
  if (before !== undefined && before.served.scheme === list.channel) {
    before.update(list);
    return before;
  }
  const made = listChannel(list, onProblem, processes);
  held.set(list.name, made);
  return made;
}
