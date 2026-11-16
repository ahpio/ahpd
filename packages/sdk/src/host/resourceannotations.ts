import { annotationsReducer } from '@microsoft/agent-host-protocol';
import type { Annotation, AnnotationEntry, AnnotationsAction, AnnotationsState, TextRange } from '@microsoft/agent-host-protocol';
import { ANNOTATIONS_SCHEME, annotatedResourceOf, schemeOf } from './channels.js';
import { personOf, shortId } from './shared.js';
import { mapPosition, type TextChange } from './textchanges.js';
import type { Connection } from '../types/host.js';
import type { Grant, Principal } from '../types/users.js';
import type { PublishOptions } from '../types/plugin.js';
import type { ResourceAnnotationsStore } from '../types/host.js';
import type { Origin } from './state.js';

/**
 * Comments on a resource, outside any session: `x-ahpd-annotations:<resource URI>`.
 *
 * The state, the actions and the reducer are AHP's own annotations. What the
 * host adds: the channel is keyed by a resource and not by a session; each
 * new entry is stamped with who wrote it and when; an `origin.session` names
 * a session the writer has, or the channel itself; and while the resource is
 * open as a shared resource, each range moves with the edits.
 */

/** Who wrote an entry, as the host stamps it under `_meta.ahpd`. */
export interface Writer {
  /** `user:<id>`, `root:<client>`, `guest:<client>` or `session:<uri>`. */
  by: string;
  name: string;
}

/** What the comments need from the host. */
export interface ResourceAnnotationsPorts {
  /** Where the comments are kept; none keeps them in memory. */
  store(): ResourceAnnotationsStore | undefined;
  /** Send one action to the channel's subscribers, or to those `audience` lets see it. */
  emit(channel: string, action: Record<string, unknown>, origin?: Origin, audience?: PublishOptions): void;
  /** Whether the connection may name this session as a comment's origin. */
  hasSession(connection: Connection, session: string): boolean;
  /** The sessions' annotations channels that show this resource's comments too, besides its own channel. */
  alsoOn?(resource: string): readonly string[];
  /** Every session's comments on the resource, each kept in its session's record. */
  sessionCommentsOn?(resource: string): { session: string; annotation: Annotation }[];
  /** Whether the connection may change a comment kept in this session. */
  writesSession?(connection: Connection, session: string): boolean;
  /** Change a comment kept in this session's record, and say it where the session's comments are said. */
  markSession?(session: string, action: AnnotationsAction, origin?: Origin): void;
}

export interface ResourceAnnotations {
  /** Whether the channel is a resource's comments. */
  isChannel(channel: string): boolean;
  /** The channel of a resource's comments. */
  channelOf(resource: string): string;
  /** What reading the channel needs: the resource's own read. */
  readGrant(channel: string): Grant;
  /** What an action on the channel needs: the resource's `comment`. */
  commentGrant(channel: string): Grant;
  /** The comments kept on a resource now: the ones made outside any session. */
  stateOf(resource: string): AnnotationsState;
  /** The action with each new entry stamped as `writer`, whatever the sender put there. */
  stamped(action: AnnotationsAction, writer: Writer): AnnotationsAction;
  /** What the resource's channel shows: its own comments, and every session's comments on it. */
  shownOn(resource: string): AnnotationsState;
  /** A client's action on the channel; the answer is a reason to refuse it, or nothing. */
  dispatch(channel: string, action: Record<string, unknown>, origin: Origin, connection: Connection): string | undefined;
  /** An action from a tool or the host itself, written as `writer`. */
  write(resource: string, action: AnnotationsAction, writer: Writer, origin?: Origin): void;

  /** The resources with comments that are one of these places, or under one of them as a folder. */
  under(folders: readonly string[]): string[];
  /** Whether the resource is one of these places, or under one of them as a folder. */
  within(resource: string, places: readonly string[]): boolean;
  /** A change taken on the resource's shared channel: move each range through it. */
  moved(resource: string, change: TextChange, before: string, after: string): void;
  /**
   * The comments outside any session on the resources under these folders, as
   * a session shows them beside its own: only those on resources `reader` may
   * read. With no reader, a host with no users directory, all of them.
   */
  outsideUnder(folders: readonly string[], reader?: Principal): Annotation[];
  /** The resource under these folders, one `reader` may read, that holds this comment outside any session, or nothing. */
  holderOf(folders: readonly string[], annotationId: string, reader?: Principal): string | undefined;
}

/** The writer a connection is, as an entry's stamp names it. */
export const writerOf = (connection: Connection): Writer => {
  const person = personOf(connection);
  const by = person.kind === 'user' ? `user:${connection.principal?.id ?? ''}` : `${person.kind}:${shortId(connection)}`;
  return { by, name: person.name };
};

/** A grant on a resource's own scheme: `file:` for a path with no scheme. */
const grantOn = (resource: string, operation: string): Grant => {
  const scheme = schemeOf(resource);
  return `${scheme === '' ? 'file' : scheme}:${operation}`;
};

/** The offset of a line and a character in a text. */
const offsetOf = (text: string, line: number, character: number): number => {
  let at = 0;
  for (let n = 0; n < line; n += 1) {
    const next = text.indexOf('\n', at);
    if (next === -1) return text.length;
    at = next + 1;
  }
  const end = text.indexOf('\n', at);
  return Math.min(at + Math.max(0, character), end === -1 ? text.length : end);
};

/** The line and character of an offset in a text. */
const positionOf = (text: string, offset: number): { line: number; character: number } => {
  const before = text.slice(0, offset);
  const line = before.split('\n').length - 1;
  return { line, character: offset - (before.lastIndexOf('\n') + 1) };
};

const stamped = (entry: AnnotationEntry, writer: Writer, at: string): AnnotationEntry => ({
  ...entry,
  _meta: { ...entry._meta, ahpd: { by: writer.by, name: writer.name, at } },
});

/**
 * What a change does to a comment's range: the range moved, or a point where
 * its words were, marked outdated with its thread kept. Nothing for a comment
 * the change leaves where it was, a resolved one, or one with no range.
 */
const movedBy = (annotation: Annotation, change: TextChange, before: string, after: string): AnnotationsAction | undefined => {
  const range = annotation.range;
  if (range === undefined || annotation.resolved) return undefined;
  const from = offsetOf(before, range.start.line, range.start.character);
  const to = offsetOf(before, range.end.line, range.end.character);
  const start = mapPosition(from, change, 1);
  const end = Math.max(start, mapPosition(to, change, -1));
  const gone = from < to && start === end;
  const next: TextRange = { start: positionOf(after, start), end: positionOf(after, end) };
  if (!gone && next.start.line === range.start.line && next.start.character === range.start.character
    && next.end.line === range.end.line && next.end.character === range.end.character) return undefined;
  if (!gone) return { type: 'annotations/updated', annotationId: annotation.id, range: next } as unknown as AnnotationsAction;
  const ahpd = { ...(annotation._meta?.ahpd as Record<string, unknown> | undefined), outdated: true };
  return { type: 'annotations/set', annotation: { ...annotation, range: next, _meta: { ...annotation._meta, ahpd } } } as unknown as AnnotationsAction;
};

export function createResourceAnnotations(ports: ResourceAnnotationsPorts): ResourceAnnotations {
  const held = new Map<string, AnnotationsState>();

  const stateOf = (resource: string): AnnotationsState => {
    const known = held.get(resource);
    if (known !== undefined) return known;
    const kept = ports.store()?.read(resource) ?? { annotations: [] };
    held.set(resource, kept);
    return kept;
  };

  const keep = (resource: string, state: AnnotationsState): void => {
    held.set(resource, state);
    ports.store()?.write(resource, state);
  };

  /** The action with each new entry stamped as `writer`, whatever the sender put there. */
  const withStamps = (action: AnnotationsAction, writer: Writer): AnnotationsAction => {
    const at = new Date().toISOString();
    const type = String(action.type);
    if (type === 'annotations/set') {
      const set = action as unknown as { annotation: Annotation };
      return { ...action, annotation: { ...set.annotation, entries: set.annotation.entries.map((one) => stamped(one, writer, at)) } } as AnnotationsAction;
    }
    if (type === 'annotations/entrySet') {
      const entry = (action as unknown as { entry: AnnotationEntry }).entry;
      return { ...action, entry: stamped(entry, writer, at) } as AnnotationsAction;
    }
    return action;
  };

  /** Whether `reader` may read the resource, as its own comments' channel asks: none is a host with no users directory. */
  const reads = (reader: Principal | undefined, resource: string): boolean => reader === undefined || reader.can(grantOn(resource, 'get'));

  const apply = (resource: string, action: AnnotationsAction, origin?: Origin): void => {
    keep(resource, annotationsReducer(stateOf(resource), action));
    ports.emit(`${ANNOTATIONS_SCHEME}:${resource}`, action as unknown as Record<string, unknown>, origin);
    // A session's channel holds readers of the session, not all of them readers of the resource: each is asked, at this send and at every replay.
    const audience: PublishOptions = { visible: (reader) => reads(reader, resource) };
    for (const channel of ports.alsoOn?.(resource) ?? []) ports.emit(channel, action as unknown as Record<string, unknown>, origin, audience);
  };

  /** A resource's comments made outside any session: their origin is the resource's own channel. */
  const outside = (resource: string): Annotation[] =>
    stateOf(resource).annotations.filter((one) => one.origin?.session === `${ANNOTATIONS_SCHEME}:${resource}`);

  /** Every resource with comments kept, here or in the store. */
  const known = (): string[] => [...new Set<string>([...held.keys(), ...(ports.store()?.list?.() ?? [])])];

  const within = (resource: string, places: readonly string[]): boolean =>
    places.some((place) => resource === place || resource.startsWith(place.endsWith('/') ? place : `${place}/`));

  const under = (folders: readonly string[]): string[] => {
    return known().filter((resource) => within(resource, folders))
      .filter((resource) => stateOf(resource).annotations.length > 0);
  };

  return {
    isChannel: (channel) => annotatedResourceOf(channel) !== undefined,
    channelOf: (resource) => `${ANNOTATIONS_SCHEME}:${resource}`,
    readGrant: (channel) => grantOn(annotatedResourceOf(channel) ?? '', 'get'),
    commentGrant: (channel) => grantOn(annotatedResourceOf(channel) ?? '', 'comment'),
    stateOf,
    stamped: (action, writer) => withStamps(action, writer),
    shownOn: (resource) => ({ annotations: [...stateOf(resource).annotations, ...(ports.sessionCommentsOn?.(resource) ?? []).map((one) => one.annotation)] }),

    dispatch(channel, action, origin, connection) {
      const resource = annotatedResourceOf(channel);
      if (resource === undefined) return `${channel} is not a resource's comments`;
      const type = String(action.type ?? '');
      if (!type.startsWith('annotations/')) return `${type} is not an annotations action`;
      // An origin names a session the writer has, or the channel itself.
      const named = type === 'annotations/set'
        ? (action.annotation as { origin?: { session?: unknown } } | undefined)?.origin?.session
        : (action.origin as { session?: unknown } | undefined)?.session;
      if (named !== undefined && named !== channel && !(typeof named === 'string' && ports.hasSession(connection, named))) {
        return `origin.session must be a session of yours, or ${channel}`;
      }
      if (type === 'annotations/set') {
        const annotation = action.annotation as Annotation | undefined;
        if (annotation === undefined || annotation.resource !== resource) return `a comment on ${channel} must name ${resource} as its resource`;
      }
      /*
       * A session's comment, shown here from its session's record, is changed
       * there, by someone who may change that session's comments.
       */
      const target = typeof action.annotationId === 'string' ? action.annotationId : undefined;
      const kept = target === undefined || stateOf(resource).annotations.some((one) => one.id === target)
        ? undefined : ports.sessionCommentsOn?.(resource).find((one) => one.annotation.id === target);
      if (kept !== undefined && ports.markSession !== undefined) {
        if (ports.writesSession?.(connection, kept.session) !== true) return `${kept.session}'s comments are not yours to change`;
        ports.markSession(kept.session, withStamps(action as unknown as AnnotationsAction, writerOf(connection)), origin);
        return undefined;
      }
      // Updating or removing an entry keeps it on this resource; the reducer ignores an unknown id.
      apply(resource, withStamps(action as unknown as AnnotationsAction, writerOf(connection)), origin);
      return undefined;
    },

    write(resource, action, writer, origin) {
      apply(resource, withStamps(action, writer), origin);
    },


    under,
    within,

    outsideUnder: (folders, reader) => under(folders).filter((resource) => reads(reader, resource)).flatMap(outside),

    holderOf: (folders, annotationId, reader) => under(folders)
      .find((resource) => reads(reader, resource) && outside(resource).some((one) => one.id === annotationId)),

    moved(resource, change, before, after) {
      const state = held.get(resource) ?? (ports.store() === undefined ? undefined : stateOf(resource));
      for (const annotation of state?.annotations ?? []) {
        const action = movedBy(annotation, change, before, after);
        if (action !== undefined) apply(resource, action);
      }
      // A session's comments on the resource move too, kept in the session's record.
      for (const { session, annotation } of ports.sessionCommentsOn?.(resource) ?? []) {
        const action = movedBy(annotation, change, before, after);
        if (action !== undefined) ports.markSession?.(session, action);
      }
    },
  };
}
