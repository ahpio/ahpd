/**
 * The operations of the plugin channels a running daemon holds.
 *
 * Nothing is copied from a fold: the channels are the ones the host serves at
 * the moment of the call, so a fold the host refused offers nothing, and one it
 * took is offered at once.
 */

import { pluginOperationChannels, type HostOptions, type OperationChannel, type PluginChannel } from '@ahpd/sdk';

/** The plugin operations of one daemon. */
export interface PluginOperations {
  /** The channels that offer operations now, by URI. */
  channels(): Record<string, OperationChannel>;
  /**
   * Offer nothing more from these channels, whose plugin is about to close.
   *
   * Held by the channel and not by the plugin's id: a plugin loaded again
   * registers a channel of its own, which is offered once the host serves it.
   */
  close(channels: Record<string, { channel: PluginChannel }>): void;
  /** Lines already written, such as the load's, which a call does not write again. */
  said(problems: readonly string[]): void;
}

/** How many lines are kept as said. A message a plugin varies would grow the list without end. */
const SAID = 500;

export const pluginOperations = (options: {
  /** The channels the host serves, and nothing before the host exists. */
  channels(): HostOptions['channels'];
  onProblem(message: string): void;
}): PluginOperations => {
  const closed = new WeakSet<PluginChannel>();
  const said = new Set<string>();
  const note = (line: string): boolean => {
    if (said.has(line)) return false;
    if (said.size >= SAID) said.clear();
    said.add(line);
    return true;
  };
  return {
    channels: () => pluginOperationChannels(options.channels(), {
      closed: (channel) => closed.has(channel),
      onProblem: (line) => { if (note(line)) options.onProblem(line); },
    }),
    close: (channels) => { for (const one of Object.values(channels)) closed.add(one.channel); },
    said: (problems) => { for (const line of problems) note(line); },
  };
};
