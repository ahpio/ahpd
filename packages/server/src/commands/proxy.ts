/**
 * `ahpd gateway list`: the model names this daemon would serve, and the
 * providers that serve each.
 *
 * Nothing is called and no key is read: the listing answers what the file says
 * the model gateway knows, which is the table the routing will be by. A
 * provider is a connector now, so its endpoint and key are the connectors
 * store's and are listed there; an entry only names the adapter or the
 * connector id.
 */

import { output } from '@cofold/commands';
import type { Command, Registry } from '@cofold/commands';
import type { ModelEntry, ModelPrice, ProxyConfiguration } from '../proxy/providers.js';
import { flagFields, optionsFrom } from './options.js';
import type { ServedFacts } from './served.js';

/** One model name and the entries that serve it. */
export interface ModelRow {
  /** The name as `<maker>/<name>`. */
  name: string;
  /** Each provider serving it, in the order the file lists them. */
  providers: readonly ModelEntry[];
}

/** What a model costs there, as the sentence that says so. */
const priceOf = (price: ModelPrice | undefined): string | undefined => {
  if (price === undefined) return undefined;
  const parts = [
    price.input === undefined ? undefined : `$${String(price.input)} in`,
    price.output === undefined ? undefined : `$${String(price.output)} out`,
  ].filter((part) => part !== undefined);
  return parts.length === 0 ? undefined : `${parts.join(', ')} per Mtok`;
};

/** One entry of a model name, as the line that says where it is served. */
const entryLine = (entry: ModelEntry): string => {
  const price = priceOf(entry.price);
  return `    ${entry.provider}: ${entry.id}${price === undefined ? '' : ` (${price})`}`;
};

export const declareProxy = (registry: Registry<object>, served?: ServedFacts): Command => registry.action({
  id: 'gateway.list',
  summary: 'The model names this model gateway would serve, and the providers that serve each',
  description: 'Every model name with the providers serving it. A provider is a connector, so its endpoint and key are listed with the connectors rather than here.',
  surfaces: { cli: { pattern: ['gateway', 'list'] }, http: { method: 'GET', path: '/gateway/list' } },
  // No key: this is the listing, and each row names the provider an entry calls.
  effect: 'read',
  resource: { kind: 'provider' },
  scopes: ['config:read'],
  // Served, the list is the daemon's own, so no field could name another.
  ...(served === undefined ? { input: flagFields } : {}),
  run: (context) => {
    const proxy: ProxyConfiguration = served === undefined
      ? optionsFrom(context.input as Readonly<Record<string, unknown>>).modelGateway
      : served.options.modelGateway;
    const models: ModelRow[] = Object.entries(proxy.models).map(([name, providers]) => ({ name, providers }));

    const text = models.length === 0
      ? 'models:\n  (none named)\n'
      : `models:\n${models.map((row) => `  ${row.name}\n${row.providers.map((entry) => `${entryLine(entry)}\n`).join('')}`).join('')}`;
    return output({ models }, text);
  },
});
