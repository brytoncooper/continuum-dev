# @continuum-dev/contract

```bash
npm install @continuum-dev/contract
```

## Why It Exists

Continuum only works if every layer agrees on the same model for:

- what the current UI structure is,
- where user-owned state lives,
- and what the atomic handoff between those two things looks like.

`@continuum-dev/contract` is that shared model.

It exists so that generated views, adapters, runtime reconciliation, session state, and framework bindings can all speak the same durable vocabulary without pulling higher-level policy into the model layer.

## How It Works

The package is intentionally small:

- `ViewDefinition`
  - describes the current render tree
- `DataSnapshot`
  - stores user-owned state separately from that tree
- `ContinuitySnapshot`
  - pairs `{ view, data }` atomically

A few details matter:

- `DataSnapshot.values` is flat, even when the view tree is nested
- top-level nodes usually use their raw `id` as the data key
- nested nodes usually use canonical scoped ids like `profile/email`
- collection state lives under the collection node id as `NodeValue<CollectionNodeState>`
- collection item values use template-relative paths like `address-item/city`
- `key` and `semanticKey` are optional identity hints that higher layers can use when views change

This package only defines the model. It does not reconcile, validate, persist, stream, or manage a session timeline by itself.

If you need the operational DTOs around this model, such as actions, checkpoints, stream payloads, or view patch payloads, those live in `@continuum-dev/protocol`.

## What It Is

`@continuum-dev/contract` is a headless TypeScript contract package for Continuum's pure model layer.

Import everything from the package root:

```ts
import type {
  CollectionNodeState,
  ContinuitySnapshot,
  DataSnapshot,
  NodeValue,
  ViewDefinition,
} from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
```

The public root export includes:

- view model types
- data snapshot types
- `ContinuitySnapshot`
- `getChildNodes(...)`

There are no public subpath imports.

## Simplest Way To Use It

Most direct users start by authoring a `ViewDefinition`, then pairing it with a `DataSnapshot` when another layer needs actual state.

### Minimal Flow

```ts
import type {
  ContinuitySnapshot,
  DataSnapshot,
  ViewDefinition,
} from '@continuum-dev/contract';

const view: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'email',
      type: 'field',
      dataType: 'string',
      label: 'Email',
      key: 'profile.email',
      semanticKey: 'person.email',
    },
  ],
};

const data: DataSnapshot = {
  // Top-level nodes usually use their raw id as the data key.
  values: {
    email: { value: 'ada@example.com', isDirty: true },
  },
  // Lineage gives higher layers snapshot provenance.
  lineage: {
    timestamp: Date.now(),
    sessionId: 'session-1',
    viewId: view.viewId,
    viewVersion: view.version,
  },
};

// This is the atomic handoff used by runtime, session, and UI layers.
const snapshot: ContinuitySnapshot = { view, data };
```

### Normal Contract Order

1. define a `ViewDefinition`
2. give every node its required `id` and `type`
3. add `key`, `semanticKey`, `hash`, or `migrations` only when you need continuity metadata
4. store user-owned state in `DataSnapshot.values`
5. pair `{ view, data }` into `ContinuitySnapshot` when another layer needs both together

### About Data Keys

The most common source of confusion is that `DataSnapshot.values` is flat even when the view tree is nested.

Examples:

- top-level field `email`
  - `values.email`
- nested field `profile -> email`
  - `values['profile/email']`
- collection root `addresses`
  - `values.addresses`
- collection item field `address-item -> city`
  - inside the collection value, `items[n].values['address-item/city']`

### About `id`, `key`, and `semanticKey`

These fields do different jobs:

- `id`
  - required
  - structural identifier for this node in this view version
  - also provides the raw path segment used in canonical data ids
- `key`
  - optional
  - scoped continuity identity that higher layers can use when a node is renamed or restored
- `semanticKey`
  - optional
  - explicit semantic identity that higher layers can use for stronger cross-structure continuity when it is unique

If you do not need continuity across changing views, `id` alone is enough.

### What Is Required

For the model itself:

- `ViewDefinition`
  - `viewId`, `version`, `nodes`
- all nodes
  - `id`, `type`
- `FieldNode`
  - `dataType`
- `GroupNode`, `RowNode`, `GridNode`
  - `children`
- `CollectionNode`
  - `template`
- `ActionNode`
  - `intentId`, `label`
- `PresentationNode`
  - `contentType`, `content`

For `DataSnapshot`:

- `values`
- `lineage.timestamp`
- `lineage.sessionId`

## Other Options

### Collections

Use `CollectionNode` when one node owns repeatable item state.

The stored value shape is:

```ts
{
  value: {
    items: Array<{
      values: Record<string, NodeValue>;
    }>;
  };
}
```

### Lineage And Detached Values

Use these fields when higher layers need provenance or safe preservation:

- `lineage`
  - snapshot-level provenance
- `valueLineage`
  - per-value provenance
- `detachedValues`
  - preserved values that no longer safely map to an active node

### Migrations

Use `hash` and `migrations` when a node keeps the same intent but its stored value shape changes across versions.

### Traversal

Use `getChildNodes(node)` when you need one helper that understands:

- `group`, `row`, and `grid` children
- a `collection` template as the collection's logical child
- leaf nodes returning `[]`

### Full Reference

For the exact exported field-by-field contract, see [CONTRACT_REFERENCE.md](./CONTRACT_REFERENCE.md).

## Related Packages

- `@continuum-dev/runtime`
  - applies reconciliation policy to these shapes
- `@continuum-dev/session`
  - manages timeline, persistence, checkpoints, streams, and actions around these shapes
- `@continuum-dev/protocol`
  - defines operational DTOs that intentionally do not live in `contract`

## Dictionary Contract

### Core Terms

- `view`
  - the current declarative UI tree
- `data`
  - the current user-owned state kept separate from the tree
- `snapshot`
  - the atomic `{ view, data }` pair
- `canonical node id`
  - the flat data key used for a node, usually a `/`-joined path for nested nodes
- `detached value`
  - preserved state that no longer safely maps to an active node

### `ViewNode.type`

```ts
'field' | 'group' | 'collection' | 'action' | 'presentation' | 'row' | 'grid'
```

### `FieldNode.dataType`

```ts
'string' | 'number' | 'boolean'
```

### `GroupNode.layout`

```ts
'vertical' | 'horizontal' | 'grid'
```

### `PresentationNode.contentType`

```ts
'text' | 'markdown'
```

### `DetachedValue.reason`

```ts
'node-removed' | 'type-mismatch' | 'migration-failed'
```

## License

MIT
