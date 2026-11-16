import { ownerOfPrincipal, RpcError } from '@ahpd/sdk';
import { mayRead } from './provider.js';
import type { BotRecord } from './record.js';
import type { BotStore } from './store.js';
import type { ChannelHandle, PluginChannel, PublishOptions, Principal } from '@ahpd/sdk';

/**
 * The `x-ahpd-bots://` channel: every bot a reader may read, kept current.
 *
 * A subscribe answers `{ records }`, each entry `{ id, record }` with the
 * record a read of `bot://<id>` answers that reader: the `AGENTS.md` parts,
 * `state`, and the reader's own `session`. Three actions follow it, in the
 * shape every records channel sends:
 *
 * - `x-ahpd-bots/added` `{ id, record }` - a bot this client did not have, and may read now.
 * - `x-ahpd-bots/changed` `{ id, record }` - a bot this client has, edited, and still readable.
 * - `x-ahpd-bots/removed` `{ id }` - a bot this client has, deleted or no longer readable.
 *
 * Each client is sent only what concerns it - decision
 * `a-plugin-channel-filters-each-action-per-subscriber` - so the catalogue
 * keeps the slugs it sent to each reader, a client id and the person on it.
 * An edit that changes whether a client
 * may read the bot is `added` or `removed` to that client, never `changed`.
 *
 * A reader's `session` differs from the next reader's, so a change is
 * published once for each person who talks to the bot, and once for everyone
 * else, each with a `visible` test that lets only its own readers see it. The
 * talks are kept here by bot, read at each snapshot and told by `talked`, so
 * every publish is decided at the moment of the change, as a replay asks it.
 */

/** The channel's scheme. */
export const CATALOGUE_SCHEME = 'x-ahpd-bots';

/** The one URI the catalogue answers on. */
export const CATALOGUE = `${CATALOGUE_SCHEME}://`;

/** What the provider tells the catalogue, after its store has the change. */
export interface BotCatalogue {
  /** A bot was made, `before` absent, or edited from `before`. */
  put(bot: BotRecord, before: BotRecord | undefined): void;
  /** A bot was deleted; `bot` is the record as it was. */
  remove(bot: BotRecord): void;
}

/** How the catalogue reads what a read of one bot answers. */
export interface BotViews {
  /** The record every reader is answered, before their own `session`. */
  record(bot: BotRecord): Record<string, unknown>;
  /** Each person's talk with this bot, by whose talk it is. */
  talks(slug: string): Promise<Map<string, string>>;
  /** Whose talks a reader is answered, or nobody for a reader that has none. */
  talker(reader: Principal | undefined): string | undefined;
}

/** The catalogue, its channel, and the steps the plugin wires to the host. */
export interface Catalogue extends BotCatalogue {
  /** What `registerChannel` takes. */
  channel: PluginChannel;
  /** The handle `registerChannel` answered, which every publish goes through. */
  bind(handle: ChannelHandle): void;
  /** Memberships changed: send each client what it gained and lost. */
  recompute(): void;
  /** A person's talk with a bot was written down: send that person's readers the bot with it. */
  talked(slug: string, talker: string, session: string): void;
  /** Something a bot's record is read from changed, such as its `AGENTS.md`: send it again where it now differs. */
  touch(slug: string): void;
}

/**
 * Whether this reader sees this bot in the catalogue.
 *
 * No reader is a host with no users directory, or the root connection, and
 * both see every bot - the answer `authorize` gives the `bot:` scheme.
 */
const readable = (bot: BotRecord, reader: Principal | undefined): boolean =>
  reader === undefined || mayRead(bot, reader);

/**
 * Whose set one reader's slugs are: the client id, and the person the
 * connection is now. Several people may share a client id, and each holds
 * their own set.
 */
const readerKey = (client: string, reader: Principal | undefined): string =>
  JSON.stringify([client, reader === undefined ? '' : ownerOfPrincipal(reader)]);

/** The client id a `readerKey` was made from. */
const clientOfKey = (key: string): string => (JSON.parse(key) as [string, string])[0];

/** Who one publish is for: the test asked of each subscriber at each send and each replay. */
type Visible = (reader: Principal | undefined, client: string) => boolean;

export function botCatalogue(store: BotStore, views: BotViews): Catalogue {
  /** The slugs sent to each reader, by `readerKey`. */
  const sent = new Map<string, Set<string>>();
  /** Each bot's talks, by whose talk it is, as the last snapshot read them and `talked` told them since. */
  const talks = new Map<string, Map<string, string>>();
  /** Each bot's record as last sent, before any reader's `session`, so `touch` sends only a change. */
  const last = new Map<string, string>();
  let handle: ChannelHandle | undefined;

  /**
   * Whether this client holds this bot.
   *
   * A client with no set has had no snapshot since `left`, and is answered
   * by whether it could read the bot as it was.
   */
  const had = (client: string, reader: Principal | undefined, before: BotRecord): boolean =>
    sent.get(readerKey(client, reader))?.has(before.id) ?? readable(before, reader);

  const note = (client: string, reader: Principal | undefined, slug: string, held: boolean): void => {
    const set = sent.get(readerKey(client, reader));
    if (set === undefined) return;
    if (held) set.add(slug);
    else set.delete(slug);
  };

  /** The reader's own talk with this bot, where the catalogue knows one. */
  const sessionOf = (slug: string, reader: Principal | undefined): string | undefined => {
    const talker = views.talker(reader);
    return talker === undefined ? undefined : talks.get(slug)?.get(talker);
  };

  /** One bot as this reader is answered it. */
  const entry = (bot: BotRecord, reader: Principal | undefined): { id: string; record: Record<string, unknown> } => {
    const session = sessionOf(bot.id, reader);
    const record = views.record(bot);
    last.set(bot.id, JSON.stringify(record));
    return { id: bot.id, record: { ...record, ...(session === undefined ? {} : { session }) } };
  };

  const send = (type: 'added' | 'changed' | 'removed', body: Record<string, unknown>, options: PublishOptions): void => {
    handle?.publish(CATALOGUE, { type: `${CATALOGUE_SCHEME}/${type}`, ...body }, options);
  };

  /**
   * Send one bot as `added` or `changed`, once for each record a reader may be
   * answered: each talker's own, and the one with no session for every other
   * reader. `visible` is asked only of the readers a record is for, so the
   * note it keeps is kept once for each reader.
   */
  const publish = (type: 'added' | 'changed', bot: BotRecord, visible: Visible, to?: string): void => {
    const record = views.record(bot);
    last.set(bot.id, JSON.stringify(record));
    // A copy: a replay asks `visible` again, after later talks have changed the map.
    const held = new Map(talks.get(bot.id));
    for (const [talker, session] of held) {
      send(type, { id: bot.id, record: { ...record, session } }, {
        ...(to === undefined ? {} : { to }),
        visible: (reader, client) => views.talker(reader) === talker && visible(reader, client),
      });
    }
    send(type, { id: bot.id, record }, {
      ...(to === undefined ? {} : { to }),
      visible: (reader, client) => {
        const talker = views.talker(reader);
        return (talker === undefined || !held.has(talker)) && visible(reader, client);
      },
    });
  };

  return {
    channel: {
      grant: 'bot:read',
      describe: () => ({ title: 'Bots', description: 'Every bot the reader may read, kept current.' }),
      /*
       * A reader without the channel's grant is let in too, and served the
       * bots it may read: none, and each one a later add makes readable to it.
       * VS Code serves each client its own projection of a list, leaving out
       * what that client may not see rather than refusing the list.
       * https://github.com/microsoft/vscode/blob/6b68d3fe7dd7db9a3aaa052efc1f3a1fd4432eb2/src/vs/platform/agentHost/node/protocolServerHandler.ts#L4429
       */
      authorize: async (uri) => uri === CATALOGUE,
      /*
       * The snapshot waits for the store, as a read of `bot://` does.
       *
       * A subscribe can arrive before anything has read a bot, and the store
       * loads its cache on the first read rather than while the plugin applies.
       * A snapshot answered from an empty cache would never be corrected:
       * nothing publishes a bot that was there all along.
       *
       * Each bot's talks are read again here, so a talk whose session the host
       * dropped leaves the catalogue at the next snapshot.
       */
      snapshot: async (uri, reader, client) => {
        await store.ready();
        if (uri !== CATALOGUE) throw new RpcError(-32001, `No channel at ${uri}; the catalogue is ${CATALOGUE}`);
        const bots = store.all().filter((one) => readable(one, reader));
        for (const bot of bots) talks.set(bot.id, await views.talks(bot.id));
        sent.set(readerKey(client, reader), new Set(bots.map((one) => one.id)));
        return { records: bots.map((bot) => entry(bot, reader)) };
      },
      left: (client) => {
        for (const key of [...sent.keys()]) if (clientOfKey(key) === client) sent.delete(key);
      },
    },

    bind: (given) => { handle = given; },

    /*
     * Each publish carries a test the host asks at each send and each replay.
     * The test is also where the client's set is kept current, because it is
     * the one place that knows which client was sent what.
     */
    put: (bot, before) => {
      if (before === undefined) {
        publish('added', bot, (reader, client) => {
          if (!readable(bot, reader)) return false;
          note(client, reader, bot.id, true);
          return true;
        });
        return;
      }
      publish('changed', bot, (reader, client) => had(client, reader, before) && readable(bot, reader));
      publish('added', bot, (reader, client) => {
        if (had(client, reader, before) || !readable(bot, reader)) return false;
        note(client, reader, bot.id, true);
        return true;
      });
      send('removed', { id: bot.id }, {
        visible: (reader, client) => {
          if (!had(client, reader, before) || readable(bot, reader)) return false;
          note(client, reader, bot.id, false);
          return true;
        },
      });
    },

    /*
     * Also to a client that could read the bot as it was. After a reconnect
     * the set is the one its snapshot made, which no longer has the bot, and a
     * replayed delete still has to reach that client.
     */
    remove: (bot) => {
      talks.delete(bot.id);
      last.delete(bot.id);
      send('removed', { id: bot.id }, {
        visible: (reader, client) => {
          if (!had(client, reader, bot) && !readable(bot, reader)) return false;
          note(client, reader, bot.id, false);
          return true;
        },
      });
    },

    /*
     * The bot again, to the readers this talk is theirs and who hold it. The
     * record every other reader holds has not changed.
     */
    talked: (slug, talker, session) => {
      const held = talks.get(slug);
      if (held?.get(talker) === session) return;
      // A new map, so the publishes made before this one keep the talks they were sent with.
      talks.set(slug, new Map(held).set(talker, session));
      const bot = store.get(slug);
      if (bot === undefined) return;
      send('changed', { id: bot.id, record: { ...views.record(bot), session } }, {
        visible: (reader, client) => views.talker(reader) === talker && had(client, reader, bot) && readable(bot, reader),
      });
    },

    /*
     * The bot again, to every reader who holds it, when what it is read as
     * moved: a save of the bot writes its file too, and that write is heard
     * here after the edit was sent, with nothing new in it.
     */
    touch: (slug) => {
      const bot = store.get(slug);
      if (bot === undefined) return;
      if (last.get(slug) === JSON.stringify(views.record(bot))) return;
      publish('changed', bot, (reader, client) => had(client, reader, bot) && readable(bot, reader));
    },

    /*
     * The difference is sent with `to`, to the one client it is about, and a
     * `visible` test, to the one person on it it is about. A watch that fires
     * twice for one save finds nothing the second time.
     */
    recompute: () => {
      if (handle === undefined) return;
      const every = store.all();
      for (const { client, reader } of handle.subscribers(CATALOGUE)) {
        const key = readerKey(client, reader);
        const now = new Set(every.filter((one) => readable(one, reader)).map((one) => one.id));
        const set = sent.get(key);
        sent.set(key, now);
        // A reader with no set has nothing to diff against, and starts from here.
        if (set === undefined) continue;
        for (const bot of every) {
          if (now.has(bot.id) && !set.has(bot.id)) {
            publish('added', bot, (seen, at) => readerKey(at, seen) === key && readable(bot, seen), client);
          }
        }
        for (const id of set) {
          if (!now.has(id)) send('removed', { id }, { to: client, visible: (seen, at) => readerKey(at, seen) === key });
        }
      }
    },
  };
}
