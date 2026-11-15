import { AhpErrorCodes } from '@microsoft/agent-host-protocol';
import { INVALID_PARAMS, RpcError } from '../rpc.js';
import { reason } from '../utils/values.js';
import { SHARED_SCHEME, sharedUriOf, schemeOf } from './channels.js';
import { applyChange, checkCarets, checkChange, differenceOf, mapCaret, mapChange, type Caret, type TextChange } from './textchanges.js';
import type { ResourceStore, Watcher } from '../types/resources.js';
import type { Connection } from '../types/host.js';
import type { Origin } from './state.js';

/**
 * Shared resources: one resource, open in several clients, changed by all of them.
 *
 * A shared resource has a `kind`, which says what its state and its changes
 * are. `text` is the only kind today: a file's text, changed by
 * `{ from, to, insert }` lists. Another kind, such as a JSON record, would
 * bring its own state and its own changes on the same channel.
 *
 * The host holds the text while anyone has the file open, and puts every
 * change in order. A client sends a change with the version it was made on;
 * a change made on an older version is moved past the changes taken since,
 * so two people typing at once are never refused. The text goes back to the
 * file 2 s after the last change, and a write to the file from outside, such
 * as an agent's own tool, comes in as one change.
 *
 * The channel is `x-ahpd-shared:<resource URI>`. Its actions never enter the
 * replay buffer: a client that comes back subscribes again, and the snapshot
 * holds the whole state.
 */

/** The longest text a shared resource holds, the limit ahpw's file page uses. */
export const SHARED_LIMIT = 5_000_000;
/** How many changes a shared resource keeps, to move a change made on an older version. */
export const SHARED_LOG = 500;
/** How long after the last change the text is written. */
export const WRITE_AFTER_MS = 2_000;
/** The longest a change waits to be written while changes go on. */
export const WRITE_AT_MOST_MS = 10_000;

/** What a person is: the host's own root connection, a signed-in user, a guest on a host with no users, or an agent. */
export type SharedPersonKind = 'root' | 'user' | 'guest' | 'agent';

/** One person in a shared resource, by the client id they connected with. */
export interface SharedPerson {
  client: string;
  name: string;
  kind: SharedPersonKind;
  /** Whether they are editing, not only reading; a client says so with `editing`. */
  editing: boolean;
  ranges: Caret[];
}

/** What a subscriber is handed: the shared resource as it is now. */
export interface SharedState {
  /** What the resource is, and so what its changes are; `text` is the only kind today. */
  kind: 'text';
  resource: string;
  text: string;
  version: number;
  saved: number;
  people: SharedPerson[];
}

/** What the documents need from the host. */
export interface SharedPorts {
  /** The store that serves `file:`. */
  resources(): ResourceStore | undefined;
  /** Send one action to the channel's subscribers. */
  emit(channel: string, action: Record<string, unknown>, origin?: Origin): void;
  /** Whether any connection of this client still watches the channel. */
  watching(client: string, channel: string): boolean;
  log: { warn(message: string): void; error(message: string): void };
  /** A change was taken on a resource, with its text before and after it: the comments' ranges move with it. */
  taken?(resource: string, change: TextChange, before: string, after: string): void;
}

interface Document {
  channel: string;
  file: string;
  text: string;
  version: number;
  /** The version last written to the file, and the text written. */
  saved: number;
  savedText: string;
  /** The text being written now, so its own echo through the watch is no change. */
  writing?: string | undefined;
  /** Each change taken, with the version it was applied to. */
  log: { version: number; change: TextChange }[];
  people: Map<string, SharedPerson>;
  watcher?: Watcher;
  timer?: ReturnType<typeof setTimeout> | undefined;
  /** When the oldest change not yet written was taken. */
  unsavedSince?: number | undefined;
  /** The owner of the last `resourceWrite` to the file, said as `by` on the change it makes. */
  writer?: { owner: string; at: number } | undefined;
  /** Work on the file, one at a time: a read, a write. */
  queue: Promise<void>;
  closed: boolean;
}

/** The documents a host holds, by file URI. */
export interface SharedResources {
  /** Whether the channel is a document's. */
  isDocument(channel: string): boolean;
  /** Open the document for a subscriber, add them, and answer its state. */
  open(channel: string, connection: Connection): Promise<SharedState>;
  /** A client stopped watching a channel. */
  left(client: string, channel: string): void;
  /** A client's action on a document; the answer is a reason to refuse it, or nothing. */
  dispatch(channel: string, action: Record<string, unknown>, origin: Origin, connection: Connection): string | undefined;
  /** A `resourceWrite` named this owner for a file. */
  wroteBy(uri: string, owner: string | undefined): void;
  /** Write every open document, and stop. */
  close(): Promise<void>;
}

/** The start of a client id, to tell two people of one kind apart. */
export const shortId = (connection: Connection): string => connection.clientId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'x';

/**
 * Who a connection is, and the name others see: a user's id; `root` and the
 * start of the client id for the host's own root connection; and on a host
 * with no users directory the start of the client id and `guest`, id first,
 * because a client takes a colour from a name's first letters and two guests
 * must differ.
 */
export const personOf = (connection: Connection): { name: string; kind: SharedPersonKind } => {
  if (connection.root === true) return { name: `root ${shortId(connection)}`, kind: 'root' };
  if (connection.principal !== undefined) return { name: connection.principal.id, kind: 'user' };
  return { name: `${shortId(connection)} guest`, kind: 'guest' };
};

/** The folder a file is in, and its name, to watch the folder for that one name. */
const splitFile = (file: string): { folder: string; name: string } => {
  const cut = file.lastIndexOf('/');
  return { folder: file.slice(0, cut), name: file.slice(cut + 1) };
};

export function createSharedResources(ports: SharedPorts): SharedResources {
  const docs = new Map<string, Document>();
  const opening = new Map<string, Promise<Document>>();

  const store = (): ResourceStore => {
    const found = ports.resources();
    if (found === undefined) throw new RpcError(AhpErrorCodes.NotFound, 'This host serves no files');
    return found;
  };

  const readText = async (file: string): Promise<string> => {
    const read = await store().read(file);
    if (read.encoding !== 'utf-8') throw new RpcError(INVALID_PARAMS, `${file} is not text, so it cannot be a shared document`);
    if (read.data.length > SHARED_LIMIT) throw new RpcError(INVALID_PARAMS, `${file} is over ${SHARED_LIMIT} characters, so it cannot be a shared document`);
    return read.data;
  };

  /** The state a subscriber is handed. */
  const stateOf = (doc: Document): SharedState => ({
    kind: 'text',
    resource: doc.file,
    text: doc.text,
    version: doc.version,
    saved: doc.saved,
    people: [...doc.people.values()].map((one) => ({ ...one, ranges: one.ranges.map((r) => ({ ...r })) })),
  });

  /** Run one piece of work on the file after the ones before it. */
  const serial = (doc: Document, work: () => Promise<void>): Promise<void> => {
    const next = doc.queue.then(work).catch((error: unknown) => { ports.log.error(`${doc.file}: ${reason(error)}`); });
    doc.queue = next;
    return next;
  };

  /** Write the text to the file, if it changed since the last write. */
  const write = (doc: Document): Promise<void> => serial(doc, async () => {
    if (doc.timer !== undefined) clearTimeout(doc.timer);
    doc.timer = undefined;
    if (doc.version === doc.saved && doc.text === doc.savedText) return;
    const writes = store().write;
    if (writes === undefined) throw new Error('the file store cannot write');
    // Read first: a write from outside since the last one comes in before
    // this one replaces it.
    await takeDisk(doc);
    const text = doc.text;
    const version = doc.version;
    doc.writing = text;
    try { await writes.call(store(), doc.file, { data: text, encoding: 'utf-8' }); }
    finally { doc.writing = undefined; }
    doc.savedText = text;
    doc.saved = version;
    doc.unsavedSince = version === doc.version ? undefined : Date.now();
    if (!doc.closed) ports.emit(doc.channel, { type: `${SHARED_SCHEME}/saved`, version });
  });

  /** Write after the last change, and at least every 10 s while changes go on. */
  const scheduleWrite = (doc: Document, now = false): void => {
    if (doc.timer !== undefined) clearTimeout(doc.timer);
    doc.unsavedSince ??= Date.now();
    const wait = now ? 0 : Math.max(0, Math.min(WRITE_AFTER_MS, doc.unsavedSince + WRITE_AT_MOST_MS - Date.now()));
    doc.timer = setTimeout(() => { doc.timer = undefined; void write(doc); }, wait);
  };

  /** The changes taken since a version, or nothing when the log no longer holds them all. */
  const since = (doc: Document, version: number): TextChange[] | undefined => {
    if (version === doc.version) return [];
    const first = doc.log[0]?.version;
    if (first === undefined || version < first) return undefined;
    return doc.log.filter((one) => one.version >= version).map((one) => one.change);
  };

  /**
   * Apply a change made on `version`, moved past what was taken since; the
   * answer is the change as applied, and the text before it. The caller tells
   * `ports.taken` after it sends the change, so a client has the new text
   * before the comments that moved with it.
   */
  const take = (doc: Document, change: TextChange, version: number): { change: TextChange; before: string } | undefined => {
    const later = since(doc, version);
    if (later === undefined) return undefined;
    const moved = later.reduce((one, through) => mapChange(one, through), change);
    const before = doc.text;
    doc.text = applyChange(doc.text, moved);
    doc.log.push({ version: doc.version, change: moved });
    if (doc.log.length > SHARED_LOG) doc.log.splice(0, doc.log.length - SHARED_LOG);
    doc.version += 1;
    for (const person of doc.people.values()) person.ranges = person.ranges.map((one) => mapCaret(one, moved));
    return { change: moved, before };
  };

  /**
   * Take what changed in the file since the host last wrote it.
   *
   * The file is compared with the text last written, not with the text the
   * host holds: the host may hold edits it has not written yet, which the
   * writer never saw, and a comparison with them would undo them. What
   * differs is one change on the version last written, moved past the
   * changes taken since like any client's.
   */
  const takeDisk = async (doc: Document): Promise<void> => {
    let disk: string;
    try { disk = await readText(doc.file); }
    catch (error) {
      ports.log.warn(`${doc.file}: not read after it changed: ${reason(error)}`);
      return;
    }
    if (disk === doc.savedText || disk === doc.writing) return;
    const change = differenceOf(doc.savedText, disk);
    const base = doc.saved;
    const taken = take(doc, change, base) ?? take(doc, differenceOf(doc.text, disk), doc.version);
    // The file now holds what was read; the next comparison starts there.
    doc.savedText = disk;
    doc.saved = doc.version;
    if (taken === undefined) return;
    const by = doc.writer !== undefined && Date.now() - doc.writer.at < WRITE_AT_MOST_MS ? doc.writer.owner : undefined;
    doc.writer = undefined;
    ports.emit(doc.channel, {
      type: `${SHARED_SCHEME}/changed`,
      version: doc.version - 1,
      changes: taken.change,
      ranges: [],
      ...(by === undefined ? {} : { by }),
    });
    ports.taken?.(doc.file, taken.change, taken.before, doc.text);
    // What the host holds beside it goes back to the file at once.
    if (doc.text !== disk) scheduleWrite(doc, true);
  };

  const load = async (channel: string, file: string): Promise<Document> => {
    const text = await readText(file);
    const doc: Document = {
      channel, file, text, version: 0, saved: 0, savedText: text, log: [], people: new Map(), queue: Promise.resolve(), closed: false,
    };
    const { folder, name } = splitFile(file);
    const watch = store().watch;
    if (watch !== undefined) {
      try {
        doc.watcher = await watch.call(store(), folder, { recursive: false, includes: [name] }, (changes) => {
          if (doc.closed || !changes.some((one) => one.uri === file && one.type !== 'deleted')) return;
          void serial(doc, () => takeDisk(doc));
        });
      }
      catch (error) {
        ports.log.warn(`${file}: not watched, so a write from outside is not seen: ${reason(error)}`);
      }
    }
    return doc;
  };

  const docOf = async (channel: string, file: string): Promise<Document> => {
    const held = docs.get(file);
    if (held !== undefined && !held.closed) return held;
    const loading = opening.get(file);
    if (loading !== undefined) return await loading;
    const next = load(channel, file).finally(() => opening.delete(file));
    opening.set(file, next);
    const doc = await next;
    docs.set(file, doc);
    return doc;
  };

  /** Write the document and let it go, once nobody has it open. */
  const drop = (doc: Document): void => {
    void write(doc).finally(() => {
      if (doc.people.size > 0) return;
      doc.closed = true;
      doc.watcher?.close();
      if (doc.timer !== undefined) clearTimeout(doc.timer);
      if (docs.get(doc.file) === doc) docs.delete(doc.file);
    });
  };

  return {
    isDocument: (channel) => schemeOf(channel) === SHARED_SCHEME,

    async open(channel, connection) {
      const file = sharedUriOf(channel);
      if (file === undefined || schemeOf(file) !== 'file') {
        throw new RpcError(INVALID_PARAMS, `Only a file: URI is a shared document, not ${file ?? channel}`);
      }
      const doc = await docOf(channel, file);
      const client = connection.clientId;
      if (!doc.people.has(client)) {
        const person: SharedPerson = { client, ...personOf(connection), editing: false, ranges: [] };
        doc.people.set(client, person);
        // Said before the subscriber is added, so it goes to the others only.
        ports.emit(channel, { type: `${SHARED_SCHEME}/joined`, client, name: person.name, kind: person.kind, editing: false });
      }
      return stateOf(doc);
    },

    left(client, channel) {
      const file = sharedUriOf(channel);
      if (file === undefined) return;
      const doc = docs.get(file);
      if (doc === undefined || !doc.people.has(client) || ports.watching(client, channel)) return;
      doc.people.delete(client);
      ports.emit(channel, { type: `${SHARED_SCHEME}/left`, client });
      if (doc.people.size === 0) drop(doc);
    },

    dispatch(channel, action, origin, connection) {
      const file = sharedUriOf(channel);
      const doc = file === undefined ? undefined : docs.get(file);
      if (doc === undefined || doc.closed) return `${channel} is not open: subscribe to it first`;
      const type = String(action.type ?? '');
      const person = doc.people.get(connection.clientId);
      if (person === undefined) return `${channel} is not open on this client: subscribe to it first`;
      if (type === `${SHARED_SCHEME}/editing`) {
        if (typeof action.editing !== 'boolean') return 'editing must be true or false';
        person.editing = action.editing;
        ports.emit(channel, { type, editing: action.editing }, origin);
        return undefined;
      }
      const version = action.version;
      if (!Number.isInteger(version) || (version as number) < 0 || (version as number) > doc.version) {
        return `version must be a whole number from 0 to ${doc.version}`;
      }
      const made = version as number;
      if (type === `${SHARED_SCHEME}/selected`) {
        const later = since(doc, made);
        const given = checkCarets(action.ranges, Number.MAX_SAFE_INTEGER);
        if (given === undefined) return 'ranges must be a list of { anchor, head }';
        // Carets on a version the log no longer holds are dropped, not refused: the next ones come soon.
        if (later === undefined) return undefined;
        const ranges = later.reduce((carets, through) => carets.map((one) => mapCaret(one, through)), given)
          .map((one) => ({ anchor: Math.min(one.anchor, doc.text.length), head: Math.min(one.head, doc.text.length) }));
        person.ranges = ranges;
        ports.emit(channel, { type, version: doc.version, ranges }, origin);
        return undefined;
      }
      if (type === `${SHARED_SCHEME}/changed`) {
        const checked = checkChange(action.changes, Number.MAX_SAFE_INTEGER);
        if ('problem' in checked) return checked.problem;
        const later = since(doc, made);
        if (later === undefined) return `stale: the document is at version ${doc.version}, and version ${made} is too old to move; subscribe again`;
        // Checked against the text it was made on, once moved onto this one.
        const moved = later.reduce((one, through) => mapChange(one, through), checked.change);
        const fits = checkChange(moved, doc.text.length);
        if ('problem' in fits) return fits.problem;
        const taken = take(doc, checked.change, made);
        if (taken === undefined) return `stale: the document is at version ${doc.version}; subscribe again`;
        // The sender's carets are counted on its text after its own change; the changes it had not seen move them.
        let own = checked.change;
        let carets = checkCarets(action.ranges, Number.MAX_SAFE_INTEGER) ?? [];
        for (const through of later) {
          const seen = mapChange(through, own);
          carets = carets.map((one) => mapCaret(one, seen));
          own = mapChange(own, through);
        }
        carets = carets.map((one) => ({ anchor: Math.min(one.anchor, doc.text.length), head: Math.min(one.head, doc.text.length) }));
        person.ranges = carets;
        // A client's own id for the change comes back with it, so a client whose id two tabs share knows its own.
        const id = typeof action.id === 'string' && action.id.length <= 64 ? { id: action.id } : {};
        ports.emit(channel, { type, version: doc.version - 1, changes: taken.change, ranges: carets, ...id }, origin);
        ports.taken?.(doc.file, taken.change, taken.before, doc.text);
        scheduleWrite(doc);
        return undefined;
      }
      return `${type} is not an action of a shared resource`;
    },

    wroteBy(uri, owner) {
      const doc = docs.get(uri);
      if (doc !== undefined && owner !== undefined) doc.writer = { owner, at: Date.now() };
    },

    async close() {
      const open = [...docs.values()];
      for (const doc of open) {
        await write(doc).catch(() => undefined);
        doc.closed = true;
        doc.watcher?.close();
        if (doc.timer !== undefined) clearTimeout(doc.timer);
      }
      docs.clear();
    },
  };
}
