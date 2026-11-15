import { describe, expect, it } from 'vitest';
import { applyChange, checkChange, differenceOf, mapCaret, mapChange, mapPosition } from '../src/host/textchanges.js';

/*
 * The changes a shared document carries: a list of `{ from, to, insert }`,
 * every position on the text before any entry applies.
 */

describe('applyChange', () => {
  it('applies every entry on the text before any of them', () => {
    // Three carets at once: the second is at 5 in the text before the first insert.
    const text = 'a'.repeat(10);
    expect(applyChange(text, [{ from: 1, to: 1, insert: 'x' }, { from: 5, to: 5, insert: 'y' }, { from: 9, to: 10, insert: 'z' }]))
      .toBe('axaaaayaaaaz');
  });

  it('replaces and deletes', () => {
    expect(applyChange('hello world', [{ from: 0, to: 5, insert: 'goodbye' }, { from: 6, to: 11, insert: '' }])).toBe('goodbye ');
  });
});

describe('checkChange', () => {
  it('takes a list in order with no overlap', () => {
    expect(checkChange([{ from: 0, to: 1, insert: '' }, { from: 1, to: 1, insert: 'a' }], 3)).toEqual({ change: [{ from: 0, to: 1, insert: '' }, { from: 1, to: 1, insert: 'a' }] });
  });

  it('refuses entries out of order, overlapping, outside the text, or not numbers', () => {
    expect(checkChange([{ from: 2, to: 2, insert: 'a' }, { from: 1, to: 1, insert: 'b' }], 5)).toHaveProperty('problem');
    expect(checkChange([{ from: 0, to: 3, insert: '' }, { from: 2, to: 4, insert: '' }], 5)).toHaveProperty('problem');
    expect(checkChange([{ from: 0, to: 9, insert: '' }], 5)).toHaveProperty('problem');
    expect(checkChange([{ from: '0', to: 1, insert: '' }], 5)).toHaveProperty('problem');
    expect(checkChange('nope', 5)).toHaveProperty('problem');
  });
});

describe('mapPosition', () => {
  const insertAt4 = [{ from: 4, to: 4, insert: 'XY' }];
  it('moves a position after an insert before it', () => {
    expect(mapPosition(6, insertAt4)).toBe(8);
    expect(mapPosition(2, insertAt4)).toBe(2);
  });

  it('keeps a position at an insert before it with assoc -1, and after it with assoc 1', () => {
    expect(mapPosition(4, insertAt4, -1)).toBe(4);
    expect(mapPosition(4, insertAt4, 1)).toBe(6);
  });

  it('moves a position inside a deleted span to its start, and its end after the replacement', () => {
    const replace = [{ from: 2, to: 6, insert: 'Z' }];
    expect(mapPosition(4, replace, -1)).toBe(2);
    expect(mapPosition(4, replace, 1)).toBe(3);
    expect(mapPosition(6, replace)).toBe(3);
    expect(mapPosition(8, replace)).toBe(5);
  });
});

describe('mapChange', () => {
  it('puts an insert at the same place after the change taken first', () => {
    const text = 'abcdef';
    const first = [{ from: 3, to: 3, insert: 'A' }];
    const second = [{ from: 3, to: 3, insert: 'B' }];
    expect(applyChange(applyChange(text, first), mapChange(second, first))).toBe('abcABdef');
  });

  it('keeps text the first change inserted inside a span the second deletes', () => {
    const text = 'abcdef';
    const first = [{ from: 3, to: 3, insert: 'XY' }];
    const second = [{ from: 1, to: 5, insert: '' }];
    expect(applyChange(applyChange(text, first), mapChange(second, first))).toBe('aXYf');
  });

  it('puts the replacement in the first piece of a split span', () => {
    const text = 'abcdef';
    const first = [{ from: 3, to: 3, insert: 'XY' }];
    const second = [{ from: 1, to: 5, insert: '-' }];
    expect(applyChange(applyChange(text, first), mapChange(second, first))).toBe('a-XYf');
  });

  it('leaves a span the first change already removed as nothing', () => {
    const text = 'abcdef';
    const first = [{ from: 1, to: 5, insert: '' }];
    const second = [{ from: 2, to: 4, insert: '' }];
    expect(applyChange(applyChange(text, first), mapChange(second, first))).toBe('af');
  });

  it('moves a change made earlier in the text by nothing, and one later by the length the first added', () => {
    const first = [{ from: 10, to: 10, insert: 'four' }];
    expect(mapChange([{ from: 2, to: 3, insert: 'x' }], first)).toEqual([{ from: 2, to: 3, insert: 'x' }]);
    expect(mapChange([{ from: 20, to: 21, insert: 'x' }], first)).toEqual([{ from: 24, to: 25, insert: 'x' }]);
  });

  it('reaches one text whichever of two concurrent edits the host takes first, when they do not touch', () => {
    const text = 'The quick brown fox';
    const ana = [{ from: 4, to: 9, insert: 'slow' }];
    const rafael = [{ from: 16, to: 19, insert: 'cat' }];
    const anaFirst = applyChange(applyChange(text, ana), mapChange(rafael, ana));
    const rafaelFirst = applyChange(applyChange(text, rafael), mapChange(ana, rafael));
    expect(anaFirst).toBe('The slow brown cat');
    expect(rafaelFirst).toBe(anaFirst);
  });
});

describe('mapCaret', () => {
  it('moves both ends of a selection', () => {
    expect(mapCaret({ anchor: 10, head: 2 }, [{ from: 0, to: 0, insert: 'abc' }])).toEqual({ anchor: 13, head: 5 });
  });
});

describe('differenceOf', () => {
  it('replaces only what lies between the shared start and end', () => {
    expect(differenceOf('hello world', 'hello there world')).toEqual([{ from: 6, to: 6, insert: 'there ' }]);
    expect(differenceOf('abcdef', 'abXf')).toEqual([{ from: 2, to: 5, insert: 'X' }]);
    expect(differenceOf('same', 'same')).toEqual([]);
  });

  it('turns the first text into the second', () => {
    for (const [a, b] of [['', 'new'], ['old', ''], ['aaaa', 'aa'], ['abab', 'ab'], ['xyz', 'abc']]) {
      expect(applyChange(a!, differenceOf(a!, b!))).toBe(b);
    }
  });
});
