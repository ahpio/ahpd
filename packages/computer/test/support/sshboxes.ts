import { keepSshBox } from '../../src/owners.js';
import type { SshBox, SshBoxes, SshMachine } from '../../src/ssh.js';
import type { Adapter, ConnectorOwner } from '../../../sdk/src/types/connectors.js';

/**
 * Boxes for the ssh runtime on its own, from one map of box to login.
 *
 * Each box is reached with a login of its own name, which holds the
 * destination, the port and the key; the rest is the box's record. A create
 * adds to the map and a remove takes from it, so a test reads what the
 * runtime did to its records here.
 */
export const boxesOf = (machines: Record<string, SshMachine>): SshBoxes & { held: Map<string, SshBox> } => {
  const logins = new Map(Object.entries(machines).map(([name, one]) => [name, {
    destination: one.destination,
    ...(one.port === undefined ? {} : { port: one.port }),
    ...(one.identity === undefined ? {} : { identity: one.identity }),
  }]));
  const held = new Map<string, SshBox>(Object.entries(machines).map(([name, one]) => [name, {
    connector: name,
    ...(one.workdir === undefined ? {} : { workdir: one.workdir }),
    ...(one.host === undefined ? {} : { host: one.host }),
    ...(one.agents === undefined ? {} : { agents: one.agents }),
  }]));
  return {
    held,
    records: () => Object.fromEntries(held),
    login: async (connector) => logins.get(connector) ?? `the ssh login ${connector} is not open`,
    add: async (name, box) => {
      if (!logins.has(box.connector)) throw new Error(`the ssh login ${box.connector} is not open, so ${name} is not made`);
      held.set(name, box);
    },
    forget: (name) => { held.delete(name); },
  };
};

/** What a loaded plugin's options hold that a login is opened through. */
interface WithAdapters {
  adapters?: Record<string, Adapter>;
}

/** The config an ssh connector is made with, from the fields of an old `ssh.machines` entry. */
const loginConfig = (one: SshMachine): Record<string, unknown> => ({
  destination: one.destination,
  ...(one.port === undefined ? {} : { port: one.port }),
  ...(one.identity === undefined ? {} : { auth: 'file', identity: one.identity }),
});

/**
 * Open one ssh login through a loaded plugin's adapter, as the host does
 * when a connector is made or the daemon starts with one stored.
 */
export const openLogin = (options: WithAdapters, id: string, config: Record<string, unknown>, owner: ConnectorOwner = 'host'): void => {
  const adapter = options.adapters?.ssh;
  if (adapter === undefined) throw new Error('the computer plugin registered no ssh adapter');
  adapter.open({ id, adapter: 'ssh', owner, config });
};

/**
 * Make boxes into computers on a loaded plugin: a host login for each, opened
 * through the plugin's adapter, and its record beside the configuration.
 */
export const openBoxes = (options: WithAdapters, configDir: string, machines: Record<string, SshMachine>): void => {
  for (const [name, one] of Object.entries(machines)) {
    openLogin(options, name, loginConfig(one));
    keepSshBox(configDir, `ssh.${name}`, {
      connector: name,
      ...(one.workdir === undefined ? {} : { workdir: one.workdir }),
      ...(one.host === undefined ? {} : { host: one.host }),
      ...(one.agents === undefined ? {} : { agents: one.agents }),
    }, {}, () => {});
  }
};

/** Open a host login for each server a profile names, from what an old `ssh.machines` entry said. */
export const openServers = (options: WithAdapters, machines: Record<string, SshMachine>): void => {
  for (const [name, one] of Object.entries(machines)) openLogin(options, name, loginConfig(one));
};
