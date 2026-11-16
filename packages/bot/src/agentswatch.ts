import { pathToFileURL } from 'node:url';
import { AGENTS_FILE } from './folder.js';
import type { BotRecord } from './record.js';
import type { ResourceStore, Watcher } from '@ahpd/sdk';

/**
 * A watch on each bot's `AGENTS.md`, so an edit the bot makes to its own file
 * reaches the catalogue as an edit of the bot.
 *
 * A read of `bot://<slug>` takes the file's parts as it reads, and the
 * catalogue sends the same record, but nothing tells the catalogue when the
 * file changed: the record in the store did not. Each bot's workspace folder
 * is watched, not recursively, for that one name. A watch on the file itself
 * would go silent after a save that renames a new file over it, and the
 * folder is what a large workspace costs nothing extra to watch.
 *
 * A bot in a machine has no local file, so it has no watch. A workspace that
 * is not there yet is not watched, and the bot's next change asks again.
 */
export interface AgentsWatch {
  /** Watch this bot's file, or watch it again where its workspace moved. */
  follow(bot: BotRecord): void;
  /** Stop watching this bot's file. */
  drop(slug: string): void;
  /** Stop every watch. */
  close(): void;
}

/** One bot's watch, held from the moment it is asked for. */
interface Held {
  workspace: string;
  watcher?: Watcher;
  closed: boolean;
}

/**
 * The watches over `watch`, which is the host filesystem's own in the plugin,
 * and none where a store has no watch.
 * `changed` is told the slug of each bot whose file moved.
 */
export function agentsWatch(watch: ResourceStore['watch'], changed: (slug: string) => void): AgentsWatch {
  const held = new Map<string, Held>();

  const drop = (slug: string): void => {
    const one = held.get(slug);
    if (one === undefined) return;
    one.closed = true;
    one.watcher?.close();
    held.delete(slug);
  };

  return {
    follow: (bot) => {
      // A store that cannot watch leaves the catalogue as it was before this watch.
      if (watch === undefined) return;
      if (bot.computer !== undefined) {
        drop(bot.id);
        return;
      }
      if (held.get(bot.id)?.workspace === bot.workspace) return;
      drop(bot.id);
      const one: Held = { workspace: bot.workspace, closed: false };
      held.set(bot.id, one);
      void watch(pathToFileURL(bot.workspace).href, { recursive: false, includes: [AGENTS_FILE] }, () => { changed(bot.id); }).then(
        (watcher) => {
          // Dropped while the watch was opening: it is not wanted any more.
          if (one.closed) watcher.close();
          else one.watcher = watcher;
        },
        () => {
          // No folder yet: forgotten, so the bot's next change asks again.
          if (held.get(bot.id) === one) held.delete(bot.id);
        },
      );
    },
    drop,
    close: () => {
      for (const slug of [...held.keys()]) drop(slug);
    },
  };
}
