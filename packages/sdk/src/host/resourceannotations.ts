import { annotationsReducer } from '@microsoft/agent-host-protocol';
import type { Annotation, AnnotationEntry, AnnotationsAction, AnnotationsState, TextRange } from '@microsoft/agent-host-protocol';
import { ANNOTATIONS_SCHEME, annotatedResourceOf, schemeOf } from './channels.js';
import { personOf, shortId } from './shared.js';
import { mapPosition, type TextChange } from './textchanges.js';
import type { Connection } from '../types/host.js';
import type { Grant } from '../types/users.js';
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
  /** Send one action to the channel's subscribers. */
  emit(channel: string, action: Record<string, unknown>, origin?: Origin): void;
  /** Whether the connection may name this session as a comment's origin. */
  hasSession(connection: Connection, session: string): boolean;
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
  /** The comments on a resource now. */
  stateOf(resource: string): AnnotationsState;
  /** A client's action on the channel; the answer is a reason to refuse it, or nothing. */
  dispatch(channel: string, action: Record<string, unknown>, origin: Origin, connection: Connection): string | undefined;
  /** An action from a tool or the host itself, written as `writer`. */
  write(resource: string, action: AnnotationsAction, writer: Writer, origin?: Origin): void;
  /** The resources with comments whose URI starts with one of these folders. */
  under(folders: readonly string[]): string[];
  /** A change taken on the resource's shared channel: move each range through it. */
  moved(resource: string, change: TextChange, before: string, after: string): void;
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

  const apply = (resource: string, action: AnnotationsAction, origin?: Origin): void => {
    keep(resource, annotationsReducer(stateOf(resource), action));
    ports.emit(`${ANNOTATIONS_SCHEME}:${resource}`, action as unknown as Record<string, unknown>, origin);
  };

  return {
    isChannel: (channel) => annotatedResourceOf(channel) !== undefined,
    channelOf: (resource) => `${ANNOTATIONS_SCHEME}:${resource}`,
    readGrant: (channel) => grantOn(annotatedResourceOf(channel) ?? '', 'get'),
    commentGrant: (channel) => grantOn(annotatedResourceOf(channel) ?? '', 'comment'),
    stateOf,

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
      // Updating or removing an entry keeps it on this resource; the reducer ignores an unknown id.
      apply(resource, withStamps(action as unknown as AnnotationsAction, writerOf(connection)), origin);
      return undefined;
    },

    write(resource, action, writer, origin) {
      apply(resource, withStamps(action, writer), origin);
    },

    under(folders) {
      const known = new Set<string>([...held.keys(), ...(ports.store()?.list?.() ?? [])]);
      return [...known].filter((resource) => folders.some((folder) => resource.startsWith(folder.endsWith('/') ? folder : `${folder}/`)))
        .filter((resource) => stateOf(resource).annotations.length > 0);
    },

    moved(resource, change, before, after) {
      const state = held.get(resource) ?? (ports.store() === undefined ? undefined : stateOf(resource));
      if (state === undefined || state.annotations.length === 0) return;
      for (const annotation of state.annotations) {
        const range = annotation.range;
        if (range === undefined || annotation.resolved) continue;
        const from = offsetOf(before, range.start.line, range.start.character);
        const to = offsetOf(before, range.end.line, range.end.character);
        const start = mapPosition(from, change, 1);
        const end = Math.max(start, mapPosition(to, change, -1));
        const gone = from < to && start === end;
        const next: TextRange = { start: positionOf(after, start), end: positionOf(after, end) };
        if (next.start.line === range.start.line && next.start.character === range.start.character
          && next.end.line === range.end.line && next.end.character === range.end.character && !gone) continue;
        if (!gone) {
          apply(resource, { type: 'annotations/updated', annotationId: annotation.id, range: next } as unknown as AnnotationsAction);
          continue;
        }
        // Its words are gone: a point where they were, marked outdated, and the thread kept.
        const ahpd = { ...(annotation._meta?.ahpd as Record<string, unknown> | undefined), outdated: true };
        apply(resource, { type: 'annotations/set', annotation: { ...annotation, range: next, _meta: { ...annotation._meta, ahpd } } } as unknown as AnnotationsAction);
      }
    },
  };
}
