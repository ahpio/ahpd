---
title: A list and its kinds
created: 2026-11-25
refs:
  - git://8d554d00f - main when the facts were checked, with #479
  - file:///github/ahp-review/briefs/lists-and-kinds/ - where this brief was drafted, with Softov, on 2026-11-25
  - file:///github/ahp-review/briefs/resource-kinds/ - the earlier try this brief takes instances, relations, rows kept outside ahpd and runtime rows from
  - "[briefs/a-todo-app-is-the-first-agent-app.md](a-todo-app-is-the-first-agent-app.md) - the list no plugin owns, and `registerList`"
  - "[briefs/a-crm-is-the-second-example-kind.md](a-crm-is-the-second-example-kind.md) - kinds from several plugins in one list"
  - "[briefs/the-host-keeps-a-machines-services.md](the-host-keeps-a-machines-services.md) - beorn's services and deploy, the second example"
  - "[code://packages/sdk/src/types/tunnels.ts#L132-L201](../../packages/sdk/src/types/tunnels.ts#L132-L201) - `TunnelKind`, the one kind a plugin registers today"
  - "[code://packages/sdk/src/kinds/operations.ts](../../packages/sdk/src/kinds/operations.ts) - `x-ahpd/invokeOperation`, which runs a kind's operations"
---

# A list and its kinds

A plugin declares a list that the host serves and no plugin owns, and any plugin adds kinds of record to it. A client draws the list, its filters, its rows, their forms and their buttons from what the host sends, with no code for the list. This is how tunnels work in ahpd today, made generic.

It takes from two earlier tries, and replaces neither yet:

| Try | Kept | Not kept |
| --- | --- | --- |
| The todo and CRM briefs (`registerList`, #479) | A list no plugin owns, which a declaration with the same name joins. A channel named after the list, such as `x-ahpd-tickets://`. | Nothing says where a row comes from, how a list is filtered, sorted or paged, how rows relate, or how they are drawn. |
| `resource-kinds`, in ahp-review | Instances, relations, rows kept outside ahpd, runtime rows, paging. Its views wait, as *Views come later* says. | `x-ahpd-kind://<kind>`, and one kind as one list from one plugin. |

It is defined in two steps: `registerList`, then `registerKind` for each kind in it. Three examples follow one case each:

- *Example: brbyte Desk tickets from several connectors*: rows kept in another system, with several connectors.
- *Example: a machine's services*: rows that are processes, on a machine.
- *Example: a CRM with kinds from several plugins*: several plugins in one list, and links between lists.

## Step 1: `registerList`

The list is what every row in it shares, whatever its kind.

```ts
host.registerList({
  name: 'ticket',
  channel: 'x-ahpd-tickets',
  title: 'Tickets',
  description: 'Requests people make for help.',
  icon: 'issues',
  filters: [
    { field: 'status', type: 'enum' },
    { field: 'createdAt', type: 'range' },
    { field: 'client', type: 'uri', channel: 'x-ahpd-clients' },
  ],
  search: ['title'],
  sorts: ['createdAt', 'updatedAt', 'status'],
  defaultSort: '-updatedAt',
  page: { size: 50 },
});
```

| Part | What it is |
| --- | --- |
| `name` | One row is `<name>://<instance>/<id>`. |
| `channel` | The list's channel scheme, such as `x-ahpd-tickets`, so the list is `x-ahpd-tickets://`. Required. A declaration with the same `name` and another `channel` is a warning on its plugin's row. |
| `title`, `description`, `icon` | What a client shows for the list. The first declaration loaded gives them, and one that differs is a warning on its plugin's row. |
| `filters` | An array of filters, in the order a client draws them. A filter is `{ field, type }`, and the field is its name in a query. A filter type is `enum`, `range`, `uri` or `boolean`. The schema is not changed. |
| `search` | The fields a free-text search reads, as `?search=`. |
| `sorts`, `defaultSort` | The fields a client may sort by, and the order with none asked. `-` is descending. |
| `page` | The page size. A list with no `page` sends every row on subscribe, as a records channel does today. |

The grants are the list's: `<name>:get`, `<name>:put` and `<name>:delete`, as the tunnels' are. An operation may name its own grant.

A client asks for part of a list on the channel URI, with the filters and sorts the list declares:

```text
x-ahpd-tickets://?status=1,2&client=client://desk-production/5120&sort=-createdAt
```

The host refuses a filter or a sort the list does not declare.

## Step 2: `registerKind`

A kind is one type of record in a list, from any plugin.

```ts
const tickets = host.registerKind({
  channel: 'x-ahpd-tickets',
  name: 'desk-ticket',
  title: 'Desk ticket',
  class: 'data',
  source: 'kind',
  schema,
  operations,
  relations: {
    client:       { channel: 'x-ahpd-clients', one: 'client' },
    interactions: { channel: 'x-ahpd-interactions', many: 'ticket' },
  },
  rows: { list: (query, instance, reader) => ..., read: (id, instance, reader) => ... },
  invoke: (operation, row, report, input) => ...,
});
tickets.addInstance({ id: 'desk-production', title: 'Desk' });
```

| Part | What it is |
| --- | --- |
| `channel` | The channel of the list it joins, such as `x-ahpd-tickets`. |
| `name`, `title` | Its name, unique in the list. An operation id is `<kind>/<operation>`, as `devtunnel/create` is today. |
| `class` | `data`: a record a person reads and changes. `runtime`: a process with a state, as a tunnel is. |
| `source` | `host`: the host keeps the rows, as for tunnels and todos. `kind`: the rows are the kind's to answer, from `rows`, as Desk's tickets are Desk's. |
| `schema` | The fields a row has, as JSON Schema with AHP's `enumLabels`. Filters and sorts name these fields and do not change them. |
| `operations` | The kind's own verbs, as `KindOperation` is today, run by `x-ahpd/invokeOperation`. |
| `relations` | Which fields hold the URI of a row of another list, one or many. A form draws a picker from that list. |
| instances | Where a row comes from: a connector, a machine, an account. `addInstance` and `removeInstance` change them at run time, and the list's subscribers are told. |

A list filter names a field. A kind that lacks the field, or has it with another type, takes no part in that filter. Its rows are left out while the filter is set.

## What the host does

- It serves the list's `channel` with the rows of every kind and every instance, filtered, sorted and paged as the list declares.
- For a `host` kind, it keeps the rows and serves create, update and remove with the kind's schema as their form.
- For a `kind` kind, it asks the kind's `rows` for each page and each read, and keeps no copy.
- It serves one row at `<name>://<instance>/<id>`, read with `resourceRead`.
- It lists the list in `ahpd.channels`, with `kinds`, one entry per kind, as [a-todo-app-is-the-first-agent-app.md](a-todo-app-is-the-first-agent-app.md) says.

## Who writes

- **No open branch of `ahpio/ahpd`** changes tunnels, `invokeOperation` or the records channel. Nothing here is built.
- **beorn's fork** serves services and deploy on their own channels, `x-hh-services://` and `x-hh-deploys://`. *Example: a machine's services* is what they would become.
- **ahpw** draws tunnels, agents and connectors with code for each. A list drawn from this shape needs none.
- **The todo and CRM briefs** keep their app and their CRM. Where they say how a list is declared, filtered or named, this brief replaces them.

## Views come later

How a client draws a list, as a table, a board or a calendar, waits until the list and the kind are settled. So does how it draws one row. A view only names fields, filters and relations, so it adds to this shape and changes none of it. Until then, a client draws a plain list and a plain form from the schema.

## What Softov chose while drafting

| What | Source |
| --- | --- |
| Neither the todo and CRM briefs nor `resource-kinds` is enough alone; this brief takes from both | Softov, 2026-11-25: "neither one is right in my point of view" |
| A list's channel is named after the list, not `x-ahpd-kind://customer` | Softov, 2026-11-25: "`x-ahpd-customer://`" |
| The declaration names its channel as a whole scheme, `channel: 'x-ahpd-tickets'`, in place of `plural` | Softov, 2026-11-25: "channel: 'x-ahpd-tickets'" |
| Filters and sorts are their own keys on the list, and do not change a kind's schema | Softov, 2026-11-25: "filters and sorts separated. so it does not affect the schema definition" |
| `registerList` first, then `registerKind` | Softov, 2026-11-25: "registerList and registerKind" |
| Filters are an array | Softov, 2026-11-25: "and not a array?" |
| Views wait until the list and the kind are settled | Softov, 2026-11-25: "maybe view can be done one next steps. when structure is well defined?" |
| A filter is `{ field, type }`, and free text is `search` | (defaulted: no `id` to repeat the field) |

## Example: brbyte Desk tickets from several connectors

The `desk` plugin shows the tickets of brbyte Desk. A person adds one connector per Desk instance, such as production and staging, and sees the tickets of every instance in one list. The rows stay in Desk: ahpd keeps no copy. This is the case for instances and for rows kept outside ahpd.

The record's fields are Desk's, as `resource-kinds/example-01/desk-tickets.md` in ahp-review has them.

### The list

The `desk` plugin declares the list, so it works with no other plugin. A GitHub plugin could declare `ticket` too and add its own kind.

```ts
host.registerList({
  name: 'ticket', channel: 'x-ahpd-tickets', title: 'Tickets',
  filters: [
    { field: 'status', type: 'enum' },
    { field: 'client', type: 'uri', channel: 'x-ahpd-clients' },
    { field: 'consultant', type: 'uri', channel: 'x-ahpd-clients' },
    { field: 'createdAt', type: 'range' },
    { field: 'updatedAt', type: 'range' },
  ],
  search: ['title', 'clientName'],
  sorts: ['updatedAt', 'createdAt', 'status'],
  defaultSort: '-updatedAt',
  page: { size: 50 },
});
```

### The kind, and its instances

The plugin registers the kind when it loads, with no instance. Each Desk connector that is enabled becomes an instance, and one that is disabled or removed stops being one.

```ts
const tickets = host.registerKind({
  channel: 'x-ahpd-tickets', name: 'desk-ticket', title: 'Desk ticket',
  class: 'data', source: 'kind',
  schema: deskTicketSchema,               // every field readOnly: a ticket changes by an operation only
  operations: [answer, setStatus, assign],
  relations: {
    client:       { channel: 'x-ahpd-clients', one: 'client' },
    consultant:   { channel: 'x-ahpd-clients', one: 'consultant' },
    interactions: { channel: 'x-ahpd-interactions', many: 'ticket' },
  },
  rows: {
    list: (query, instance, reader) => desk(instance).tickets(query),   // one page, filtered and sorted by Desk
    read: (id, instance, reader) => desk(instance).ticket(id),
  },
  invoke: (operation, row, report, input) => desk(row.instance).run(operation, row.id, input),
});

host.onConnector('desk', {
  enabled:  (connector) => tickets.addInstance({ id: connector.id, title: connector.title }),
  disabled: (connector) => tickets.removeInstance(connector.id),
});
```

`host.onConnector` does not exist in ahpd today. It stands for any way a plugin hears that a connector of its adapter came or went.

### How the instance is correlated

The instance is the connector's id, and it is in every place a row is named:

| Where | Value |
| --- | --- |
| A row's URI | `ticket://desk-production/18432` |
| A row in the channel | `{ "id": "18432", "instance": "desk-production", "kind": "desk-ticket", "record": { ... } }` |
| A related row | `"client": "client://desk-production/5120"` |
| A query for one instance | `x-ahpd-tickets://?instance=desk-production` |
| A run of an operation | the host hands `invoke` the row, and `row.instance` names the connector to call |

Two instances can hold a ticket with the same Desk number, and their URIs still differ.

A related row names its own instance. A ticket of `desk-production` names a client of `desk-production`, so a client picker in its forms lists that instance's clients.

### One row

```jsonc
{
  "id": "18432",
  "instance": "desk-production",
  "kind": "desk-ticket",
  "record": {
    "title": "Ramal não registra depois da atualização",
    "status": 1,
    "client": "client://desk-production/5120",
    "clientName": "Padaria Central",
    "consultant": "client://desk-production/77",
    "consultantName": "Ana Souza",
    "createdAt": "2026-11-12T13:02:00Z",
    "updatedAt": "2026-11-13T10:41:00Z"
  },
  "operations": ["desk-ticket/answer", "desk-ticket/set-status", "desk-ticket/assign"]
}
```

A closed ticket lists no `answer`.

### What this example needs from the shape

- **Instances at run time.** A connector added later is a new instance, and the list's subscribers are told.
- **Rows the host does not keep.** Every page and every read is a request to Desk. The host has no event when someone answers in Desk's own screen. So a row changes on the channel only when it changed through ahpd, unless the plugin polls.
- **Filters and sorts that Desk serves.** The kind turns the list's query into Desk's own.
- **Relations across lists of the same plugin.** `clients` and `interactions` are lists the `desk` plugin also declares.

### Open points of this example

1. **Paging across instances.** The default sort is by date across production and staging. Does the host ask each instance for a page and merge them, or does the list show one instance at a time?
2. **A connector that fails.** An instance's Desk cannot be reached. Are its rows left out with an alert on the list, or is the whole page refused?
3. **Who may read which instance.** A connector has an owner. Does a reader see only the instances of connectors they may use?

## Example: a machine's services

A person sees the programs a machine runs, starts, stops and restarts them, and deploys a new version of one. The rows are processes with a state that nobody stores. This is the case for runtime rows, instances per machine, and a long operation.

beorn proposed it on #474, from their `services` and `deploy` plugins for process-compose. [the-host-keeps-a-machines-services.md](the-host-keeps-a-machines-services.md) has what they built.

### The list

```ts
host.registerList({
  name: 'service', channel: 'x-ahpd-services', title: 'Services',
  description: 'The programs this machine runs.',
  filters: [
    { field: 'status', type: 'enum' },
  ],
  search: ['name', 'command'],
  sorts: ['name', 'status'],
  defaultSort: 'name',
});
```

No `page`: a machine runs tens of services, and the list sends every row.

### Two kinds

process-compose and systemd are two kinds from two plugins. Each has its own form for a new service, and both rows share the fields the list filters on.

```ts
// in the process-compose plugin
const compose = host.registerKind({
  channel: 'x-ahpd-services', name: 'process-compose', title: 'process-compose',
  class: 'runtime', source: 'host',
  schema: {
    type: 'object', required: ['name', 'command'],
    properties: {
      name:    { type: 'string', title: 'Name' },
      command: { type: 'string', title: 'Command' },
      restart: { type: 'string', title: 'Restart', enum: ['always', 'on_failure', 'no'] },
      status:  { type: 'string', title: 'Status', readOnly: true, 'x-ahpd-live': true,
                 enum: ['stopped', 'starting', 'running', 'failed'],
                 enumLabels: ['Stopped', 'Starting', 'Running', 'Failed'] },
      url:     { type: ['string', 'null'], format: 'uri', title: 'Address', readOnly: true, 'x-ahpd-live': true },
    },
  },
  operations: [
    { id: 'start', label: 'Start', icon: 'play', offered: (s) => s.status !== 'running' },
    { id: 'stop', label: 'Stop', icon: 'debug-stop', offered: (s) => s.status === 'running' },
    { id: 'restart', label: 'Restart', icon: 'debug-restart', offered: (s) => s.status === 'running' },
  ],
  invoke: (operation, row, report) => processCompose.control(row, operation),
});
compose.addInstance({ id: hostname(), title: hostname() });

// in a systemd plugin: the same list, another kind and another form
host.registerKind({ channel: 'x-ahpd-services', name: 'systemd', title: 'systemd unit', class: 'runtime', source: 'host', schema: unitSchema, operations: unitOperations, invoke: systemd });
```

A `live` field is set by the process and stored nowhere. A client draws it as state, never in a form, and a write to it is refused. The mark is on the schema because it says what the field is, not how a list uses it.

### How the instance is correlated

Each ahpd host keeps its own machine's services, so a kind has one instance: the machine.

| Where | Value |
| --- | --- |
| A row's URI | `service://build-01/web` |
| A row in the channel | `{ "id": "web", "instance": "build-01", "kind": "process-compose", "record": { ... } }` |

A host that runs sessions in machines, as ahpd's machines do, could add each machine as an instance. Nothing here needs that yet.

### Deploy

beorn's deploy is one operation on every service with a deploy declaration, whatever its kind. It fetches, builds, switches and checks, rolls back on a failed check, and keeps the last N releases. It takes minutes.

```ts
// in the deploy plugin
host.registerOperation({
  channel: 'x-ahpd-services',
  operation: { id: 'deploy/deploy', label: 'Deploy', icon: 'rocket',
               input: { type: 'object', required: ['version'], properties: { version: { type: 'string', title: 'Version' } } },
               offered: (s) => s.deploy !== undefined },
  invoke: (row, report, input) => deploy(row, input.version, report),
});
```

`registerOperation` is new, and is the open point 4 of this brief: an operation from a plugin that registers no kind of the list.

`build` and `check` are commands the host runs. beorn keeps them on the service's own record, so `deploy:deploy` alone chooses no command. Who may write the deploy declaration decides who may run code on the machine.

### What this example needs from the shape

- **A runtime class**, with live fields that nobody stores.
- **Two kinds with different forms in one list**, filtered on the fields they share.
- **An operation from another plugin**, on rows of every kind.
- **A long operation**, with a state a person can follow for minutes, and a log.

### Open points of this example

1. **The word.** `ahpd service` already names the daemon as the machine's own service. Does the list keep the name "services"?
2. **Deploy's state.** A status on the row, or a run with its own lifecycle and log, as an automation run has?
3. **Who may write a deploy declaration.**

## Example: a CRM with kinds from several plugins

A `crm` plugin keeps clients, tickets and interactions on the host. A mail plugin adds emails to the interactions, and a phone plugin adds calls. No plugin owns the interactions list. This is the case for several plugins in one list, rows the host keeps, and links between lists.

It is [a-crm-is-the-second-example-kind.md](a-crm-is-the-second-example-kind.md), written with the list's filters and sorts.

### The lists

```ts
// in @local/crm
host.registerList({ name: 'client', channel: 'x-ahpd-clients', title: 'Clients',
  search: ['name', 'email'],
  sorts: ['name'], defaultSort: 'name' });

host.registerList({ name: 'interaction', channel: 'x-ahpd-interactions', title: 'Interactions',
  filters: [
    { field: 'ticket', type: 'uri', channel: 'x-ahpd-tickets' },
    { field: 'client', type: 'uri', channel: 'x-ahpd-clients' },
    { field: 'at', type: 'range' },
  ],
  sorts: ['at'], defaultSort: '-at', page: { size: 50 } });
```

The mail plugin declares `interaction` too, with the same name, so it works without the CRM. Its declaration joins the CRM's. The first one loaded gives the title, and a declaration that differs is a warning on its plugin's row.

### Kinds from three plugins

Every kind in `interactions` has the fields the list filters and sorts on: `ticket`, `client`, `at` and `summary`. Each adds its own.

```ts
// in @local/crm
host.registerKind({ channel: 'x-ahpd-interactions', name: 'note', title: 'Note', class: 'data', source: 'host',
  schema: { type: 'object', required: ['client', 'summary'], properties: {
    client:  { type: 'string', format: 'uri', title: 'Client' },
    ticket:  { type: ['string', 'null'], format: 'uri', title: 'Ticket' },
    at:      { type: 'string', format: 'date-time', title: 'When', readOnly: true },
    summary: { type: 'string', title: 'Note', format: 'textarea' } } },
  relations: { client: { channel: 'x-ahpd-clients', one: 'client' }, ticket: { channel: 'x-ahpd-tickets', one: 'ticket' } } });

// in @local/mail
host.registerKind({ channel: 'x-ahpd-interactions', name: 'email', title: 'Email', class: 'data', source: 'host',
  schema: emailSchema,                 // client, ticket, at, summary, plus to, subject, body, state
  operations: [{ id: 'send', label: 'Send', icon: 'send', offered: (email) => email.state === 'draft' }],
  relations: { client: { channel: 'x-ahpd-clients', one: 'client' }, ticket: { channel: 'x-ahpd-tickets', one: 'ticket' } },
  invoke: (operation, row, report) => mail.send(row, report) });

// in @local/phone
host.registerKind({ channel: 'x-ahpd-interactions', name: 'call', title: 'Call', class: 'data', source: 'host', schema: callSchema, relations });
```

A host-kept kind has one instance, the host. Its rows are `interaction://local/i-88`, or `interaction://i-88` if the instance is left out, which is the open point 1 of this brief.

### Links between lists

| From | Field | To | Drawn as |
| --- | --- | --- | --- |
| An interaction | `client` | one row of `clients` | a picker in the form, a link in the row |
| An interaction | `ticket` | one row of `tickets` | the same |
| A ticket | `interactions` | many rows of `interactions`, by their `ticket` field | a list of rows |

A ticket's interactions are read as `x-ahpd-interactions://?ticket=ticket://local/t-1042`, a filter the interactions list declares.

### A send

```jsonc
{ "jsonrpc": "2.0", "id": 9, "method": "x-ahpd/invokeOperation",
  "params": { "channel": "x-ahpd-interactions://", "operationId": "email/send", "target": { "id": "interaction://local/i-88" } } }
```

The host finds the kind from the row, and hands the call to the mail plugin's `invoke`. While the mail server answers, the row's `operation` is `{ "id": "email/send", "status": "running" }`. Later the mail plugin learns the email bounced and changes the row itself, and every reader of the list hears it.

### What this example needs from the shape

- **A list no plugin owns**, joined by a declaration with the same name.
- **Kinds from several plugins that share the list's fields**, each with its own form and operations.
- **Relations across lists**, both one and many, with the many side read through a filter.
- **A kind that changes its own rows** after an operation has answered.

### Open points of this example

1. **Two declarations that differ in filters.** The CRM declares a filter the mail plugin's declaration lacks. Are the filters joined, or does the first one win as the title does?
2. **A kind that lacks a list field.** A phone call with no ticket: `ticket` is null, which a filter on `ticket` can still read. A kind with no `ticket` field at all is left out of that filter.

## Open points

1. **A kind with one instance.** Does a host-kept todo still carry an instance in its URI, as `todo://local/t-1`? Or is the instance left out when a kind has only one?
2. **Paging across sources.** One page of tickets sorted by date, from Desk and from GitHub, means merging two sources. Does the host merge, or does a client page per kind or per instance?
3. **A list filter on a field some kinds lack.** Leaving those rows out, as *Step 2* says, or keeping them unfiltered?
4. **An operation from another plugin.** beorn's deploy runs on every service, whatever its kind. Can a plugin add an operation to rows of kinds it does not register?
5. **Long operations.** A deploy takes minutes. Is a status on the row enough, or does an operation become a run with its own lifecycle, as an automation run is?
6. **The word "kind".** It also names `Operation.kind` in ahpd today, which is the same meaning, and `KindOperation`.
