import { expect, it } from 'vitest';
import { retrying, waitsOf, worthRetrying } from '../src/retry.js';

/*
 * The one retry rule both senders follow: which answers are tried again, after
 * which waits, and the check that drops a retry whose notice is no longer due.
 * The waits are recorded rather than slept, so a case reads them as numbers.
 */

/** A request that answers each status in turn, `throw` for a network failure, and counts its calls. */
const answering = (said: (number | 'throw')[]) => {
  let calls = 0;
  const attempt = async (): Promise<Response> => {
    const next = said[calls] ?? 200;
    calls += 1;
    if (next === 'throw') throw new Error('the network is gone');
    return new Response(null, { status: next });
  };
  return { attempt, calls: () => calls };
};

/** A wait that records how long it was asked to be, and returns at once. */
const recorded = () => {
  const waited: number[] = [];
  return { waited, wait: async (ms: number) => { waited.push(ms); } };
};

// Softov 2026-11-28, "One list of waits": the length is the number of retries.
it('retries after each wait of the list, in order, while the request fails', async () => {
  const request = answering([503, 503, 503, 503]);
  const { waited, wait } = recorded();
  const tried = await retrying(request.attempt, { waits: [2000, 30000, 90000], wait, due: () => true });
  expect(request.calls()).toBe(4);
  expect(waited).toEqual([2000, 30000, 90000]);
  expect(tried).toMatchObject({ kind: 'answered', response: { status: 503 } });
});

it('makes one request and no retry when the list is empty', async () => {
  const request = answering([503]);
  const { waited, wait } = recorded();
  await retrying(request.attempt, { waits: [], wait, due: () => true });
  expect(request.calls()).toBe(1);
  expect(waited).toEqual([]);
});

it('retries a thrown request, a 429 and a 5xx, and answers anything else at once', async () => {
  expect(worthRetrying(undefined)).toBe(true);
  for (const status of [429, 500, 503]) expect(worthRetrying(new Response(null, { status }))).toBe(true);
  for (const status of [200, 201, 400, 401, 404, 410]) expect(worthRetrying(new Response(null, { status }))).toBe(false);

  const request = answering(['throw', 429, 400]);
  const { wait } = recorded();
  const tried = await retrying(request.attempt, { waits: [1, 1, 1, 1], wait, due: () => true });
  expect(request.calls()).toBe(3);
  expect(tried).toMatchObject({ kind: 'answered', response: { status: 400 } });
});

it('answers unreachable when the last attempt threw', async () => {
  const request = answering(['throw', 'throw']);
  const { wait } = recorded();
  const tried = await retrying(request.attempt, { waits: [1], wait, due: () => true });
  expect(tried.kind).toBe('unreachable');
  expect(tried.kind === 'unreachable' ? String(tried.failure) : '').toContain('the network is gone');
});

// Softov 2026-11-28, "Drop a stale retry".
it('drops a retry that comes due when the notice no longer is', async () => {
  const request = answering([503, 503, 503]);
  const { wait } = recorded();
  let asked = 0;
  const tried = await retrying(request.attempt, { waits: [1, 1], wait, due: () => { asked += 1; return asked < 2; } });
  expect(request.calls()).toBe(2);
  expect(tried.kind).toBe('dropped');
});

it('reads retryWaits as seconds of 0 or more, and nothing else', () => {
  expect(waitsOf([2, 30, 90])).toEqual([2000, 30000, 90000]);
  expect(waitsOf([0, 0.5])).toEqual([0, 500]);
  expect(waitsOf([])).toEqual([]);
  for (const said of ['2,30', [2, '30'], [-1], [Number.NaN], [Number.POSITIVE_INFINITY], { one: 2 }, null]) {
    expect(waitsOf(said)).toBeUndefined();
  }
});
