# Continuum Contract Reference

This file is the exact consumer reference for `@continuum-dev/contract`.

## Public Boundary

The public import surface is the package root only:

```ts
import {
  getChildNodes,
  type ContinuitySnapshot,
  type DataSnapshot,
  type ViewDefinition,
} from '@continuum-dev/contract';
```

Important boundary rules:

- there are no public subpath imports
- the root export re-exports symbols from:
  - `src/lib/view-definition.ts`
  - `src/lib/data-snapshot.ts`
  - `src/lib/continuity-snapshot.ts`
- this package defines the model layer only

It does not define:

- issue or diff DTOs
- interactions, intents, or checkpoints
- stream payloads or stream metadata
- reconciliation algorithms
- action handler contracts

Those concerns live in `@continuum-dev/protocol`, `@continuum-dev/runtime`, and `@continuum-dev/session`.

## Export Inventory

### From `view-definition.ts`

- `ViewDefinition`
- `ViewNode`
- `BaseNode`
- `FieldOption`
- `FieldNode`
- `GroupNode`
- `CollectionNode`
- `ActionNode`
- `PresentationNode`
- `RowNode`
- `GridNode`
- `FieldConstraints`
- `MigrationRule`
- `getChildNodes`

### From `data-snapshot.ts`

- `DataSnapshot`
- `NodeValue`
- `CollectionItemState`
- `CollectionNodeState`
- `SnapshotLineage`
- `ValueLineage`
- `DetachedValue`

### From `continuity-snapshot.ts`

- `ContinuitySnapshot`

## Contract Map

```text
ContinuitySnapshot
|- view: ViewDefinition
|  `- nodes: ViewNode[]
|     |- FieldNode
|     |- GroupNode -> children: ViewNode[]
|     |- CollectionNode -> template: ViewNode
|     |- ActionNode
|     |- PresentationNode
|     |- RowNode -> children: ViewNode[]
|     `- GridNode -> children: ViewNode[]
`- data: DataSnapshot
   |- values: Record<string, NodeValue>
   |- lineage: SnapshotLineage
   |- valueLineage?: Record<string, ValueLineage>
   `- detachedValues?: Record<string, DetachedValue>
```

## `ViewDefinition`

```ts
interface ViewDefinition {
  viewId: string;
  version: string;
  nodes: ViewNode[];
}
```

Field meanings:

- `viewId`
  - stable logical identity for the view family or workflow
- `version`
  - revision identifier for one specific structural shape
- `nodes`
  - top-level nodes in render order

Notes:

- the contract type does not enforce version ordering semantics
- higher layers usually treat `viewId` as stable and `version` as the thing that changes when structure changes

## `ViewNode`

```ts
type ViewNode =
  | FieldNode
  | GroupNode
  | CollectionNode
  | ActionNode
  | PresentationNode
  | RowNode
  | GridNode;
```

### `BaseNode`

```ts
interface BaseNode {
  id: string;
  type: string;
  key?: string;
  semanticKey?: string;
  hidden?: boolean;
  hash?: string;
  migrations?: MigrationRule[];
}
```

Field meanings:

- `id`
  - required structural identifier for this node in this view version
  - also becomes the raw path segment used by higher layers when building canonical node ids
- `type`
  - discriminant for the node variant
- `key`
  - optional scoped continuity identity
  - current runtime logic indexes it relative to the parent path rather than globally
- `semanticKey`
  - optional explicit semantic identity
  - current runtime logic only treats it as deterministic when it is unique in both compared views
- `hidden`
  - optional visibility hint for outer renderers
- `hash`
  - optional structural fingerprint used by higher layers to detect compatible versus migrated shape changes
- `migrations`
  - optional declared hash transition rules

Usage notes:

- duplicate raw `id` values are allowed by the type system
- current runtime logic expects the resulting scoped node id to be unique
- duplicate `id` values in different parent scopes can still be distinct after scoping
- duplicate `key` values in different parent scopes can also remain distinct because runtime scopes them to the parent path

### `FieldNode`

```ts
interface FieldNode extends BaseNode {
  type: 'field';
  dataType: 'string' | 'number' | 'boolean';
  label?: string;
  placeholder?: string;
  description?: string;
  readOnly?: boolean;
  defaultValue?: unknown;
  constraints?: FieldConstraints;
  options?: FieldOption[];
}
```

Supporting types:

```ts
interface FieldConstraints {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

interface FieldOption {
  value: string;
  label: string;
}
```

Notes:

- `defaultValue` is model metadata, not enforced typing
- `constraints` are portable validation metadata
- the contract package does not validate field values by itself

### `GroupNode`

```ts
interface GroupNode extends BaseNode {
  type: 'group';
  label?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  minItemWidth?: number;
  children: ViewNode[];
}
```

Notes:

- `columns` and `minItemWidth` are layout hints for outer renderers
- `children` is required

### `CollectionNode`

```ts
interface CollectionNode extends BaseNode {
  type: 'collection';
  label?: string;
  template: ViewNode;
  minItems?: number;
  maxItems?: number;
  defaultValues?: Array<Record<string, unknown>>;
  columns?: number;
  minItemWidth?: number;
}
```

Notes:

- `template` is the logical shape for one collection item
- collection state is stored as `NodeValue<CollectionNodeState>`
- `defaultValues` is an array of item payloads, not a record keyed by item id
- in the current runtime, each `defaultValues` object key is interpreted as:
  - a template `key` when one matches
  - otherwise a template-relative path string

### `ActionNode`

```ts
interface ActionNode extends BaseNode {
  type: 'action';
  intentId: string;
  label: string;
  disabled?: boolean;
}
```

Notes:

- `intentId` is model metadata here
- action dispatch contracts live outside this package

### `PresentationNode`

```ts
interface PresentationNode extends BaseNode {
  type: 'presentation';
  contentType: 'text' | 'markdown';
  content: string;
}
```

### `RowNode`

```ts
interface RowNode extends BaseNode {
  type: 'row';
  columns?: number;
  minItemWidth?: number;
  children: ViewNode[];
}
```

### `GridNode`

```ts
interface GridNode extends BaseNode {
  type: 'grid';
  columns?: number;
  minItemWidth?: number;
  children: ViewNode[];
}
```

### `MigrationRule`

```ts
interface MigrationRule {
  fromHash: string;
  toHash: string;
  strategyId?: string;
}
```

Notes:

- this is only the declarative rule shape
- migration strategy registration and execution live in runtime

## `DataSnapshot`

```ts
interface DataSnapshot {
  values: Record<string, NodeValue>;
  lineage: SnapshotLineage;
  valueLineage?: Record<string, ValueLineage>;
  detachedValues?: Record<string, DetachedValue>;
}
```

### Canonical Data Keys

The contract type does not enforce how keys in `values` are formed, but the current Continuum runtime uses canonical ids like these:

- top-level field `email`
  - `values.email`
- nested field `profile -> email`
  - `values['profile/email']`
- collection root `addresses`
  - `values.addresses`
- collection item field `address-item -> city`
  - stored inside the collection value as `items[n].values['address-item/city']`

This means `DataSnapshot.values` stays flat for normal nodes, while collection item state is nested inside the collection node's own `NodeValue`.

## `NodeValue`

```ts
interface NodeValue<T = unknown> {
  value: T;
  suggestion?: T;
  isDirty?: boolean;
  protection?: {
    owner: 'ai' | 'user';
    stage: 'flexible' | 'reviewed' | 'locked' | 'submitted';
  };
  isValid?: boolean;
}
```

Field meanings:

- `value`
  - the current stored value
- `suggestion`
  - optional proposed alternative value
- `isDirty`
  - optional marker that a user has edited the value
- `protection`
  - optional marker that the value should be protected from silent replacement
- `isValid`
  - optional stored validation status

Notes:

- the contract package stores metadata but does not enforce behavior around it
- current runtime and session layers give `suggestion`, `isDirty`, and `protection` their continuity semantics

## Collection State

```ts
interface CollectionItemState {
  values: Record<string, NodeValue>;
}

interface CollectionNodeState {
  items: CollectionItemState[];
}
```

Notes:

- each item stores a flat `values` record
- those keys are template-relative canonical paths
- nested collections can appear inside collection item values because `template` itself can contain another `CollectionNode`

## Lineage Types

### `SnapshotLineage`

```ts
interface SnapshotLineage {
  timestamp: number;
  sessionId: string;
  viewId?: string;
  viewVersion?: string;
  viewHash?: string;
  lastInteractionId?: string;
}
```

### `ValueLineage`

```ts
interface ValueLineage {
  lastUpdated?: number;
  lastInteractionId?: string;
}
```

Notes:

- `lineage` is required on `DataSnapshot`
- `valueLineage` is optional and keyed the same way as `values`

## `DetachedValue`

```ts
interface DetachedValue {
  value: unknown;
  previousNodeType: string;
  semanticKey?: string;
  key?: string;
  previousLabel?: string;
  previousParentLabel?: string;
  detachedAt: number;
  viewVersion: string;
  reason: 'node-removed' | 'type-mismatch' | 'migration-failed';
  pushesSinceDetach?: number;
}
```

Important note about `detachedValues` record keys:

- the contract type intentionally leaves the record key opaque
- in the current runtime, detached records are usually stored under:
  - the node `key` when one exists
  - otherwise the scoped node id
- the stored `semanticKey` metadata can also be used by higher layers when matching detached values back to active nodes

## `ContinuitySnapshot`

```ts
interface ContinuitySnapshot {
  view: ViewDefinition;
  data: DataSnapshot;
}
```

This is the atomic pair passed between model-aware layers.

## `getChildNodes`

```ts
function getChildNodes(node: ViewNode): ViewNode[];
```

Current behavior:

- `group`
  - returns `children`
- `row`
  - returns `children`
- `grid`
  - returns `children`
- `collection`
  - returns `[template]`
- `field`, `action`, `presentation`
  - return `[]`

This helper is the package's only runtime utility function.

## Exact Literal Contracts

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

## What To Read Next

- [`README.md`](./README.md)
  - package overview and simplest usage path
- [`../runtime/README.md`](../runtime/README.md)
  - how reconciliation uses these contracts
- [`../session/README.md`](../session/README.md)
  - how session lifecycle builds on these contracts
