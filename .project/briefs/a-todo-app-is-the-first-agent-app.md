---
title: A todo app is the first app an agent builds
created: 2026-11-22
refs:
  - git://3f55e4349 - main when the facts were checked
  - "[briefs/plugins-are-a-sessions-extensions.md](plugins-are-a-sessions-extensions.md) - an agent builds an app that lasts, which this app is the first case of"
  - "[ideas/a-plugin-registers-a-thing-and-its-kinds.md](../ideas/a-plugin-registers-a-thing-and-its-kinds.md) - a generic thing with its kinds, which `todo` would be the first of"
  - "[briefs/a-person-acts-from-a-plugin-page.md](a-person-acts-from-a-plugin-page.md) - a plugin's page and its Buttons"
  - "[code://packages/sdk/src/types/records.ts](../../packages/sdk/src/types/records.ts) - `host.records(name)`, a plugin's own collections"
  - "[code://packages/sdk/src/types/tunnels.ts#L132-L190](../../packages/sdk/src/types/tunnels.ts#L132-L190) - `TunnelKind`, the one kind a plugin registers with a schema and operations"
  - "[code://packages/sdk/src/types/kinds.ts](../../packages/sdk/src/types/kinds.ts) - `KindOperation`, and `OperationScope`, a closed list"
  - "[code://packages/sdk/src/kinds/operations.ts#L10-L25](../../packages/sdk/src/kinds/operations.ts#L10-L25) - `x-ahpd/invokeOperation`, one command for every operation"
  - "[code://packages/sdk/src/resources/recordschannel.ts](../../packages/sdk/src/resources/recordschannel.ts) - a list of records as an `x-` channel, with owner filters"
  - "[code://packages/sdk/src/plugins/view.ts#L32](../../packages/sdk/src/plugins/view.ts#L32) - `VIEW_KINDS`, the twelve components a view may hold"
  - "[code://packages/sdk/src/plugins/view.ts#L297-L321](../../packages/sdk/src/plugins/view.ts#L297-L321) - a Button's `context` is a literal object"
  - "[code://packages/sdk/src/types/plugin.ts#L853](../../packages/sdk/src/types/plugin.ts#L853) - `ViewSurface`, only `main`"
  - "[code://packages/sdk/src/types/plugin.ts#L551-L575](../../packages/sdk/src/types/plugin.ts#L551-L575) - `PluginMethod`, which gets the caller and its owner"
  - "[code://packages/sdk/src/types/host.ts#L1422-L1582](../../packages/sdk/src/types/host.ts#L1422-L1582) - `HostTool`, with `isEnabledForSession` and `optIn`"
  - "[code://packages/sdk/src/plugins/enablement.ts](../../packages/sdk/src/plugins/enablement.ts) - on and off per scope, for plugins and MCP servers, not for tools"
  - file:///github/ahpd/.scratch/dsh-todo-app - dsh's todo app: React in the client, data in the browser
---

# A todo app is the first app an agent builds

Softov wants the first agent-built app to be a todo app, because it has all the parts: create, read, update, delete and storage. The app needs three parts: "a way to render", "its ui context", and "a way to accept actions and interact with those actions". All of it can go in 0.17. This brief writes the app as it would be, with its calls, so the missing parts show. The steps and the plans come from it.

## What others do

- **dsh** has `dsh-todo-app`. The host half is `export function apply() {}`. The client half is React code that dsh loads into its page, and the list is kept in the browser's storage. Nothing on the host can read or change a todo. Softov does not want client code injection for now.
- **VS Code** lets Copilot's agent write an agent extension that draws a canvas and gives the agent tools. The extension is a program Copilot CLI starts, not code in the window.

## What ahpd has today

- **Storage.** `host.records(name)` opens a collection of JSON records, each with a slug `id`. It has `get`, `list`, `find`, `put`, `remove` and `watch`. Records have no owner field of their own.
- **Kinds.** `registerTunnelKind` is the one call that registers a kind with a schema, operations and handlers. The host keeps the records, serves `create`, `update`, `remove`, `enable` and `disable`, and lists the kind's own operations. `OperationScope` is a closed list: `list`, `tunnel`, `client`, `agent` and `connector`. No call registers a kind of something else.
- **Actions.** `x-ahpd/invokeOperation` `{ channel, operationId, target?, input? }` runs one operation. The host checks the grant and the `input` against the operation's schema. A client draws the form from that schema.
- **Methods.** `registerMethod` serves an `x-` command. Its `handle` gets the params, the caller, its client id and its owner.
- **Channels.** `RecordsChannel` serves a list of records as an `x-` channel, with `added`, `changed` and `removed`, and reads by owner.
- **Views.** A plugin draws one view on its own page, the `main` surface, with `showView` and `setViewData`. Every reader sees the same view. The components are `Text`, `Link`, `Button`, `Card`, `Row`, `Column`, `List`, `Divider`, `Icon`, `Progress`, `DateTime` and `KeyValue`. None takes input. A Button's `context` is a literal, so a Button drawn once per row cannot send that row's id.
- **Tools.** `registerTool` gives every session a tool. `isEnabledForSession` and `optIn` let the tool itself decide per session. No switch turns a plugin's tools off while it runs, and no client switch turns one tool off for a session.

## The app

The app is a package `@local/todo`, in the plugin folder, with today's plugin shape. Each part below says whether it works today or is new.

### The package

Works today.

```json
{
  "name": "@local/todo",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "ahpd": { "title": "Todos", "description": "A shared todo list." }
}
```

### The record

Works today, with `host.records`. The app writes `owner` itself, from the method's or the tool's caller.

```json
{ "id": "t-buy-milk", "title": "Buy milk", "done": false, "owner": "user:ana", "createdAt": "2026-11-22T14:00:00Z" }
```

```js
export async function apply(host) {
  const todos = host.records('todos', { format: 'json' });
  // ...
}
```

### The kind

New. The app registers `todo` as a kind, with the shape of `TunnelKind`. The host keeps the list, serves create, update and remove, and lists the records on a channel. A client draws the form from `schema`, with no code for todos.

```js
host.registerKind({
  name: 'todo',
  title: 'Todo',
  description: 'One thing to do.',
  schema: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', title: 'Title', maxLength: 500 },
      done: { type: 'boolean', title: 'Done', default: false },
    },
  },
  operations: [
    { id: 'complete', label: 'Done', icon: 'check', offered: (t) => !t.done },
    { id: 'reopen', label: 'Not done', icon: 'undo', offered: (t) => t.done },
    { id: 'clear', label: 'Clear completed', scopes: ['list'], confirmation: 'Remove every done todo?' },
  ],
  async invoke(name, todo, report) {
    if (name === 'complete') return report({ settings: { ...todo.settings, done: true } });
    if (name === 'reopen') return report({ settings: { ...todo.settings, done: false } });
    // clear: remove each done todo
  },
});
```

### The channel

New for a kind other than a tunnel, with the shape that `x-ahpd-tunnels` serves today. A client subscribes to the kind's channel:

```json
{ "jsonrpc": "2.0", "id": 6, "method": "subscribe", "params": { "channel": "x-ahpd-todo://" } }
```

The snapshot's state holds the records and the operations. Each record lists the ids of the operations it offers now. The host makes `todo/create`, `todo/update` and `todo/remove` from the kind, with the kind's `schema` as their `input`. It lists the kind's own operations after them, each id led by the kind's name.

```json
{
  "records": [
    { "id": "t-buy-milk", "record": { "kind": "todo", "title": "Buy milk", "done": false, "owner": "user:ana",
      "createdAt": "2026-11-22T14:00:00Z", "operations": ["todo/update", "todo/remove", "todo/complete"] } },
    { "id": "t-call-bob", "record": { "kind": "todo", "title": "Call Bob", "done": true, "owner": "user:ana",
      "createdAt": "2026-11-22T13:10:00Z", "operations": ["todo/update", "todo/remove", "todo/reopen"] } }
  ],
  "operations": [
    { "id": "todo/create", "kind": "todo", "label": "Todo", "description": "One thing to do.", "scopes": ["list"],
      "grant": "todo:put", "status": "idle",
      "input": { "type": "object", "required": ["title"], "properties": {
        "title": { "type": "string", "title": "Title", "maxLength": 500 },
        "done": { "type": "boolean", "title": "Done", "default": false } } } },
    { "id": "todo/update", "kind": "todo", "label": "Edit", "scopes": ["todo"], "grant": "todo:put", "status": "idle",
      "input": { "type": "object", "required": ["title"], "properties": {
        "title": { "type": "string", "title": "Title", "maxLength": 500 },
        "done": { "type": "boolean", "title": "Done", "default": false } } } },
    { "id": "todo/remove", "kind": "todo", "label": "Remove", "confirmation": "Remove this todo?",
      "scopes": ["todo"], "grant": "todo:delete", "status": "idle" },
    { "id": "todo/complete", "kind": "todo", "label": "Done", "icon": "check", "scopes": ["todo"], "grant": "todo:put", "status": "idle" },
    { "id": "todo/reopen", "kind": "todo", "label": "Not done", "icon": "undo", "scopes": ["todo"], "grant": "todo:put", "status": "idle" },
    { "id": "todo/clear", "kind": "todo", "label": "Clear completed", "confirmation": "Remove every done todo?",
      "scopes": ["list"], "grant": "todo:put", "status": "idle" }
  ]
}
```

A client draws this with no code for todos:

- A list operation, such as `todo/create` and `todo/clear`, is a button on the list. A record operation is a button on each row that names it in `operations`.
- An operation with `input` opens a form drawn from the schema: a text field for `title` and a check box for `done`.
- An operation with `confirmation` asks it before it runs.
- `status` is `running` while a call runs, and `error` with its message when the call failed. Each subscriber gets the change as `x-ahpd-todo/operations`.
- The grants are `todo:put` and `todo:delete` in this example. Which grants a kind of a plugin gets is an open point.

A person adds a todo from a client:

```json
{ "jsonrpc": "2.0", "id": 7, "method": "x-ahpd/invokeOperation",
  "params": { "channel": "x-ahpd-todo://", "operationId": "todo/create", "input": { "title": "Buy milk" } } }
```

and marks it done:

```json
{ "jsonrpc": "2.0", "id": 8, "method": "x-ahpd/invokeOperation",
  "params": { "channel": "x-ahpd-todo://", "operationId": "todo/complete", "target": { "id": "t-buy-milk" } } }
```

Every reader of the channel then gets:

```json
{ "jsonrpc": "2.0", "method": "action", "params": { "channel": "x-ahpd-todo://", "serverSeq": 42,
  "action": { "type": "x-ahpd-todo/changed", "id": "t-buy-milk",
    "record": { "kind": "todo", "title": "Buy milk", "done": true, "owner": "user:ana",
      "createdAt": "2026-11-22T14:00:00Z", "operations": ["todo/update", "todo/remove", "todo/reopen"] } } } }
```

### The tools

Works today, with `registerTool`. An agent in any session reads and changes the same list.

```js
host.registerTool({
  definition: {
    name: 'todo_add',
    description: 'Add a todo to the shared list.',
    inputSchema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } },
  },
  async run({ title }, at) {
    const id = slugOf(title);
    await todos.put({ id, title, done: false, owner: at.person(), createdAt: new Date().toISOString() });
    return `Added ${id}.`;
  },
});
```

The four tools are `todo_list`, `todo_add`, `todo_update` (title or done) and `todo_remove`. An agent calls one as it calls any host tool:

```json
{ "name": "todo_add", "input": { "title": "Buy milk" } }
```

and gets `Added t-buy-milk.`.

### The page

Partly today. The app draws its list on its plugin page, and keeps the data model current when a record changes.

```js
host.showView({
  root: 'page',
  components: {
    page: { id: 'page', component: 'Column', children: ['head', 'items'] },
    head: { id: 'head', component: 'Text', text: { path: '/summary' } },
    items: { id: 'items', component: 'List', children: { path: '/todos', componentId: 'row' } },
    row: { id: 'row', component: 'Row', children: ['title', 'done'] },
    title: { id: 'title', component: 'Text', text: { path: 'title' } },
    done: { id: 'done', component: 'Button', label: 'Done',
            action: { event: { name: 'x-todo/complete', context: { id: { path: 'id' } } } } },
  },
  dataModel: { summary: '1 of 3 done', todos: [{ id: 't-buy-milk', title: 'Buy milk', done: false }] },
});

todos.watch(async () => host.setViewData('/todos', await todos.list()));
```

Three things in it do not work today:

- `context: { id: { path: 'id' } }` is refused, because a Button's `context` is a literal. The row's Button cannot say which todo it is.
- The page has no text field, so a person cannot type a new todo on it. The kind's `create` form gives one in the client's own list of the kind instead.
- Every reader sees the same view, so a person's own todos cannot be drawn for that person only.

## What is missing

Each row is one of Softov's three parts. "Kind" is the generic registration that the idea `a-plugin-registers-a-thing-and-its-kinds` names.

| Part | Missing | Without it |
| --- | --- | --- |
| Render | A way to register a kind other than a tunnel: `registerKind`, a channel per kind, and an open `OperationScope` | Each new thing needs new host code |
| Render | Input components in a view, such as a text field and a check box | A person types only in the kind's form |
| UI context | A view that knows its reader: per person, and per session where the page opens in one | Every reader sees one list |
| Actions | A Button `context` that reads `{ path }` inside a repeated row | One Button per row cannot name its row |
| Actions | Tools that a kind's operations give, so the app does not write them twice | The app writes four tools by hand |
| Tools | "Tools only" off for the host, from the plugins brief | A person turns the whole app off to stop its tools |

## Steps

A first order, for the plans:

1. Write the app with what works today: records, four tools, and a page that only reads. It proves the storage and the tools, and it is the example an agent copies.
2. A plugin registers a kind, with its channel and its operations. The todo list moves from the page to the kind.
3. A view's Button reads `{ path }` in its `context`, and a view gets input components.
4. A view knows its reader.
5. A plugin's tools turn off while it runs.
6. The app runs on the stdio runtime.

## Open points

- Whether a kind's operations become tools by themselves, or the app writes its tools.
- Whether a todo's owner is a field the host keeps for every kind, or a field the app writes.
- The channel's name for a plugin's kind, such as `x-ahpd-todo://` or `x-<plugin>-todo://`.
- The grants of a plugin's kind, such as `todo:put` and `todo:delete`, and the scope name a record operation takes, such as `todo`.
- Which input components a view gets first.
- Where a page opens with a session as its context: a plugin page, or a canvas in a chat.
