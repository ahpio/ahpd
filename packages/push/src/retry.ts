/**
 * The one retry rule both senders follow.
 *
 * A request that the network, a 429 or a 5xx fails is tried again after each
 * wait of the plugin's `retryWaits`, Expo's exponential backoff by default: its
 * Node SDK's two retries from one second, doubling. Any other answer is the
 * answer, retried or not. Before each retry the caller is asked whether the
 * notice is still due, so a session that moved on during a wait is not told
 * what it no longer is, as the plugin tells a completed session only if it is
 * still completed when its delay ends.
 * https://docs.expo.dev/push-notifications/sending-notifications/#retry-on-failure
 * https://github.com/expo/expo-server-sdk-node/blob/main/src/ExpoClient.ts
 */

/** The waits before each retry, in seconds, where the operator sets none. */
export const RETRY_WAITS = [1, 2] as const;

/** The same waits in milliseconds, which the senders take. */
export const RETRY_WAITS_MS: readonly number[] = RETRY_WAITS.map((seconds) => seconds * 1000);

/** How one request, with its retries, ended. */
export type Tried =
  /** The service answered, and this is its last answer. */
  | { kind: 'answered'; response: Response }
  /** The last attempt never reached the service. */
  | { kind: 'unreachable'; failure: unknown }
  /** A retry came due when the notice no longer was, so it was not sent. */
  | { kind: 'dropped' };

/** What one request is retried with. */
export interface RetryOptions {
  /** The waits before each retry, in milliseconds. Its length is the number of retries. */
  waits: readonly number[];
  /** Wait this long, which is a timer unless a test says otherwise. */
  wait: (ms: number) => Promise<void>;
  /** Whether the notice is still worth sending, asked before each retry. */
  due: () => boolean;
}

/** Whether an attempt failed in a way a retry may mend: no answer, a 429 or a 5xx. */
export const worthRetrying = (answered: Response | undefined): boolean =>
  answered === undefined || answered.status === 429 || answered.status >= 500;

/** A timer of `ms` milliseconds. */
export const timer = (ms: number): Promise<void> => new Promise<void>((done) => { setTimeout(done, ms); });

/**
 * One request, tried again after each wait while it fails in a way a retry may
 * mend. It never throws: what the last attempt threw is in the answer.
 */
export const retrying = async (attempt: () => Promise<Response>, options: RetryOptions): Promise<Tried> => {
  for (let tries = 0; ; tries += 1) {
    let answered: Response | undefined;
    let failure: unknown;
    try {
      answered = await attempt();
    }
    catch (error) {
      failure = error;
    }
    if (!worthRetrying(answered) || tries >= options.waits.length) {
      return answered === undefined ? { kind: 'unreachable', failure } : { kind: 'answered', response: answered };
    }
    await answered?.body?.cancel().catch(() => undefined);
    await options.wait(options.waits[tries] ?? 0);
    if (!options.due()) return { kind: 'dropped' };
  }
};

/**
 * The waits an operator gave as `retryWaits`, in milliseconds, or nothing when
 * the value is not a list of numbers of 0 or more.
 */
export const waitsOf = (said: unknown): number[] | undefined => {
  if (!Array.isArray(said)) return undefined;
  if (!said.every((one): one is number => typeof one === 'number' && Number.isFinite(one) && one >= 0)) return undefined;
  return said.map((seconds) => Math.round(seconds * 1000));
};
