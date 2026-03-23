# Continuum Contract Reference

`@continuum-dev/contract` is the canonical reference for the pure Continuum model layer.

## Public Surface

The package exports only three model modules:

- `./lib/view-definition.js`
- `./lib/data-snapshot.js`
- `./lib/continuity-snapshot.js`

## What Belongs Here

`contract` defines the durable, declarative Continuum vocabulary:

- view AST types like `ViewDefinition`, `ViewNode`, `FieldNode`, `GroupNode`, `CollectionNode`, `RowNode`, and `GridNode`
- user-owned state types like `DataSnapshot`, `NodeValue`, `ValueLineage`, and `SnapshotLineage`
- detached preservation types like `DetachedValue`
- the top-level `ContinuitySnapshot` pair of `{ view, data }`

## What Does Not Belong Here

Operational and workflow types are intentionally excluded from `contract`.

Those live in `@continuum-dev/protocol`, including:

- issue and diff taxonomies
- reconciliation report DTOs
- interactions, intents, and checkpoints
- action handler contracts
- view patch and stream part payloads
- session stream metadata
- detached restore review DTOs

## Relationship Map

```text
ContinuitySnapshot
|- view: ViewDefinition
|  `- nodes: ViewNode[]
|     |- FieldNode
|     |- GroupNode -> children: ViewNode[]
|     |- CollectionNode -> template: ViewNode
|     |- RowNode -> children: ViewNode[]
|     `- GridNode -> children: ViewNode[]
`- data: DataSnapshot
   |- values: Record<nodeId, NodeValue>
   |- detachedValues: Record<nodeId, DetachedValue>
   |- lineage: SnapshotLineage
   `- valueLineage: Record<nodeId, ValueLineage>
```

## Core Invariants

- `ViewDefinition.nodes[*].id` is the primary data lookup key.
- `key` is optional in the type system but recommended for semantic identity across regenerated views.
- `DataSnapshot` remains flat even when the view tree is deeply nested.
- `DetachedValue` preserves user data when structural continuity cannot be safely proven.
- `ContinuitySnapshot` is the atomic model handoff between renderer-facing and state-facing systems.

## Import Pattern

```ts
import type {
  ContinuitySnapshot,
  DataSnapshot,
  DetachedValue,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
```
