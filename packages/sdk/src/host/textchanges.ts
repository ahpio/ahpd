/**
 * Changes to a text, as a shared resource of kind `text` carries them.
 *
 * A change is a list of `{ from, to, insert }`. Every position is a character
 * offset in the text before any entry of the list applies, the entries are in
 * order, and none overlaps the next. One keystroke with three carets is one
 * change with three entries. The shape is CodeMirror's own change spec, so a
 * client on CodeMirror passes it through as it is.
 *
 * Nothing here holds state: the document that uses these keeps the text and
 * the log they work on.
 */

/** One replaced span: the text from `from` to `to` becomes `insert`. */
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

/** A change: the edits of one keystroke or one batch, on one text. */
export type TextChange = TextEdit[];

/** One caret or selection: where it started, and where the caret is. */
export interface Caret {
  anchor: number;
  head: number;
}

/**
 * The change as a well-formed list, or the reason it is not one.
 *
 * Each entry is an object with whole numbers `from <= to` and a string
 * `insert`; the list is in order, entries do not overlap, and the last ends
 * inside a text of `length` characters.
 */
export const checkChange = (given: unknown, length: number): { change: TextChange } | { problem: string } => {
  if (!Array.isArray(given)) return { problem: 'changes must be a list' };
  const change: TextChange = [];
  let end = 0;
  for (const one of given as unknown[]) {
    if (typeof one !== 'object' || one === null) return { problem: 'each change must be an object' };
    const { from, to, insert } = one as Record<string, unknown>;
    if (!Number.isInteger(from) || !Number.isInteger(to)) return { problem: 'from and to must be whole numbers' };
    if (typeof insert !== 'string') return { problem: 'insert must be text' };
    const a = from as number;
    const b = to as number;
    if (a < end || b < a) return { problem: 'changes must be in order and must not overlap' };
    if (b > length) return { problem: `a change ends at ${b}, past the text's ${length} characters` };
    change.push({ from: a, to: b, insert });
    end = b;
  }
  return { change };
};

/** The text after the change. */
export const applyChange = (text: string, change: TextChange): string => {
  let out = '';
  let at = 0;
  for (const { from, to, insert } of change) {
    out += text.slice(at, from) + insert;
    at = to;
  }
  return out + text.slice(at);
};

/**
 * Where a position is after the change.
 *
 * A position inside a replaced span moves to its start, or to the end of what
 * replaced it with `assoc` 1. The end of a replaced span is after what replaced
 * it. A position exactly where text is inserted stays before the insert with
 * `assoc` -1, and moves after it with `assoc` 1.
 */
export const mapPosition = (position: number, change: TextChange, assoc: -1 | 1 = -1): number => {
  let shift = 0;
  for (const { from, to, insert } of change) {
    if (from > position) break;
    if (from === to && from === position) {
      // An insert at the position itself.
      if (assoc === 1) {
        shift += insert.length;
        continue;
      }
      break;
    }
    if (to <= position) {
      // A span wholly before the position, or ending at it.
      shift += insert.length - (to - from);
      continue;
    }
    // The position is inside the span, or at its start.
    return assoc === 1 ? from + shift + insert.length : from + shift;
  }
  return position + shift;
};

/**
 * The change, moved past another that was applied first.
 *
 * Both were made on the same text. An insert at the place the first one
 * inserted lands after it: the change taken first goes first. A span this
 * change replaces keeps any text the first change inserted inside it, so the
 * span is split around that text, and the replacement goes in the first
 * piece. This is what CodeMirror's `ChangeSet.map` does, and a client on
 * CodeMirror reaches the same text.
 */
export const mapChange = (change: TextChange, through: TextChange): TextChange => {
  const out: TextChange = [];
  for (const { from, to, insert } of change) {
    const start = mapPosition(from, through, 1);
    if (from === to) {
      out.push({ from: start, to: start, insert });
      continue;
    }
    const pieces: { from: number; to: number }[] = [];
    let at = start;
    for (const one of through) {
      // Only text the first change inserted strictly inside this span splits it.
      if (one.insert.length === 0 || one.from <= from || one.from >= to) continue;
      const before = mapPosition(one.from, through, -1);
      pieces.push({ from: at, to: Math.max(at, before) });
      // A span the first change replaced past this span's end leaves nothing after it.
      if (one.to >= to) {
        at = Number.NaN;
        break;
      }
      at = mapPosition(one.to, through, 1);
    }
    if (!Number.isNaN(at)) pieces.push({ from: at, to: Math.max(at, mapPosition(to, through, -1)) });
    pieces.forEach((piece, i) => {
      if (i === 0 || piece.to > piece.from) out.push({ ...piece, insert: i === 0 ? insert : '' });
    });
  }
  return out;
};

/** A caret after the change. */
export const mapCaret = (caret: Caret, change: TextChange): Caret => ({
  anchor: mapPosition(caret.anchor, change, -1),
  head: mapPosition(caret.head, change, -1),
});

/** Carets as a well-formed list inside a text of `length` characters, or nothing. */
export const checkCarets = (given: unknown, length: number): Caret[] | undefined => {
  if (!Array.isArray(given)) return undefined;
  const carets: Caret[] = [];
  for (const one of given as unknown[]) {
    if (typeof one !== 'object' || one === null) return undefined;
    const { anchor, head } = one as Record<string, unknown>;
    if (!Number.isInteger(anchor) || !Number.isInteger(head)) return undefined;
    const clamp = (n: number): number => Math.min(Math.max(n, 0), length);
    carets.push({ anchor: clamp(anchor as number), head: clamp(head as number) });
  }
  return carets;
};

/**
 * The one change that turns `before` into `after`: the text both share at the
 * start and at the end is kept, and what is between them is replaced.
 */
export const differenceOf = (before: string, after: string): TextChange => {
  if (before === after) return [];
  let start = 0;
  const shorter = Math.min(before.length, after.length);
  while (start < shorter && before.charCodeAt(start) === after.charCodeAt(start)) start += 1;
  let end = 0;
  while (end < shorter - start && before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)) end += 1;
  return [{ from: start, to: before.length - end, insert: after.slice(start, after.length - end) }];
};
