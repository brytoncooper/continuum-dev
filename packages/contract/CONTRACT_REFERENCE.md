# Continuum Contract Reference

This is the canonical deep reference for `@continuum-dev/contract`.

`@continuum-dev/contract` is intentionally a zero-dependency package of shared contracts and constants. It defines the type system used by Continuum packages to preserve user state while views evolve.

## Table of Contents

- [Package Surface](#package-surface)
- [Core Domain Model](#core-domain-model)
- [Relationship Map](#relationship-map)
- [Lifecycle Context](#lifecycle-context)
- [View Contracts AST](#view-contracts-ast)
- [Data Contracts State](#data-contracts-state)
- [Interaction and Intent Contracts](#interaction-and-intent-contracts)
- [Constants](#constants)
- [Invariants](#invariants)
- [Import Pattern](#import-pattern)

## Package Surface

Public exports are re-exported from `src/index.ts`:

- `./lib/continuity-snapshot.js`
- `./lib/view-definition.js`
- `./lib/data-snapshot.js`
- `./lib/interactions.js`
- `./lib/constants.js`

## Core Domain Model

- `ViewDefinition` defines the versioned UI structure.
- `DataSnapshot` stores user-owned runtime values and lineage.
- `ContinuitySnapshot` is the atomic pairing of `view` and `data`.
- `Interaction`, `PendingIntent`, and `Checkpoint` describe events and recoverability.
- constants in `constants.ts` provide stable vocabularies.

## Relationship Map

How the contracts connect in practice:

```text
ContinuitySnapshot
|- view: ViewDefinition
|  `- nodes: ViewNode[]
|     |- FieldNode (data-bearing)
|     |- GroupNode -> children: ViewNode[]
|     |- CollectionNode -> template: ViewNode
|     |- RowNode -> children: ViewNode[]
|     |- GridNode -> children: ViewNode[]
|     |- ActionNode (intent trigger)
|     `- PresentationNode (read-only content)
`- data: DataSnapshot
   |- values: Record<nodeId, NodeValue>
   |- detachedValues: Record<nodeId, DetachedValue>
   |- lineage: SnapshotLineage
   |- valueLineage: Record<nodeId, ValueLineage>
   `- viewContext: Record<nodeId, ViewportState>

Checkpoint
`- snapshot: ContinuitySnapshot

Interaction
`- type: InteractionType

PendingIntent
`- status: IntentStatus
```

Identity rules that make the model work:

- `ViewDefinition.nodes[*].id` is the primary key for `DataSnapshot.values`.
- `key` is optional at the type level, but should be adopted as a production convention for stable semantic identity across versions/migrations.
- `viewId` + `version` identify one concrete shape of the view.
- `DataSnapshot.lineage.viewVersion` ties captured data back to the view revision.

Example of `id` vs `key` in action:

- prior view node: `{ id: "email_input", key: "user.email", type: "field" }`
- new view node: `{ id: "row_1/email_input", key: "user.email", type: "field" }`

Even though the structural `id` changed, the stable `key` allows continuity logic to carry the existing user value to the new node.

`key` adoption guidance:

- treat `key` as required-by-convention for continuity-critical nodes
- use stable semantic keys (for example `applicant.fullName`) rather than layout-derived keys
- keep `key` stable across restructures and only change it when semantics truly change
- prefer `id` for per-version addressing and `key` for cross-version matching

## Lifecycle Context

Typical runtime sequence:

1. The system receives or generates a `ViewDefinition`.
2. User edits are stored in `DataSnapshot.values[nodeId]` as `NodeValue`.
3. Current structure + state are persisted/transferred as one `ContinuitySnapshot`.
4. User/system actions are recorded as `Interaction` events.
5. Deferred commands are tracked as `PendingIntent` and moved through `INTENT_STATUS`.
6. Durable restore points are captured as `Checkpoint` objects.
7. When the view changes:
  - compatible values stay in `values`
  - migrated values are transformed using consumer logic
  - incompatible or removed values move to `detachedValues` instead of being lost

Why this separation matters:

- the AI can safely mutate layout (`ViewDefinition`) without directly mutating user data
- user intent remains auditable via lineage and interaction history
- data survives hallucinated or transient schema changes through detachment/restoration

## View Contracts AST

`ViewDefinition`:

```ts
interface ViewDefinition {
  viewId: string;
  version: string;
  nodes: ViewNode[];
}
```

`ViewNode` is a discriminated union:

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

Shared node shape:

```ts
interface BaseNode {
  id: string;
  type: string;
  key?: string;
  hidden?: boolean;
  hash?: string;
  migrations?: MigrationRule[];
}
```

```ts
interface FieldOption {
  value: string;
  label: string;
}
```

BaseNode properties and why they matter:

- `id`: required structural identifier used for per-version addressing.
- `key`: semantic identity for cross-version matching; optional by type, recommended by convention.
- `hash`: node fingerprint for compatibility checks when structure or constraints change.
- `migrations`: allowed hash transitions and strategy hints for safe data transformation.

Traversal helper:

```ts
function getChildNodes(node: ViewNode): ViewNode[];
```

## Data Contracts State

```ts
interface DataSnapshot {
  values: Record<string, NodeValue>;
  viewContext?: Record<string, ViewContext>;
  lineage: SnapshotLineage;
  valueLineage?: Record<string, ValueLineage>;
  detachedValues?: Record<string, DetachedValue>;
}
```

```ts
interface NodeValue<T = unknown> {
  value: T;
  suggestion?: T;
  isDirty?: boolean;
  isValid?: boolean;
}
```

```ts
interface CollectionItemState {
  values: Record<string, NodeValue>;
}

interface CollectionNodeState {
  items: CollectionItemState[];
}
```

```ts
interface ViewportState {
  scrollX?: number;
  scrollY?: number;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  isExpanded?: boolean;
  isFocused?: boolean;
}
```

```ts
type ViewContext = ViewportState;
```

```ts
interface DetachedValue {
  value: unknown;
  previousNodeType: string;
  key?: string;
  detachedAt: number;
  viewVersion: string;
  reason: 'node-removed' | 'type-mismatch' | 'migration-failed';
  pushesSinceDetach?: number;
}
```

```ts
interface DetachedValuePolicy {
  maxAge?: number;
  maxCount?: number;
  pushCount?: number;
}
```

```ts
interface ProposedValue {
  nodeId: string;
  proposedValue: NodeValue;
  currentValue: NodeValue;
  proposedAt: number;
  source?: string;
}
```

```ts
interface ActionRegistration {
  label: string;
  description?: string;
  icon?: string;
}
```

```ts
interface ActionContext {
  intentId: string;
  snapshot: DataSnapshot;
  nodeId: string;
}
```

```ts
type ActionHandler = (context: ActionContext) => void | Promise<void>;
```

How these state types are typically used:

- `ViewportState` tracks UI-only state and is aliased by `ViewContext`.
- `DetachedValuePolicy` configures cleanup of detached data by age, count, or push count.
- `ProposedValue` models AI suggestions versus current user values for conflict-aware UX.
- `ActionRegistration`, `ActionContext`, and `ActionHandler` define action metadata and execution context.

## Interaction and Intent Contracts

```ts
interface Interaction {
  interactionId: string;
  sessionId: string;
  nodeId: string;
  type: InteractionType;
  payload: unknown;
  timestamp: number;
  viewVersion: string;
}
```

```ts
interface PendingIntent {
  intentId: string;
  nodeId: string;
  intentName: string;
  payload: unknown;
  queuedAt: number;
  viewVersion: string;
  status: IntentStatus;
}
```

```ts
interface Checkpoint {
  checkpointId: string;
  sessionId: string;
  snapshot: ContinuitySnapshot;
  eventIndex: number;
  timestamp: number;
  trigger: 'auto' | 'manual';
}
```

## Constants

The package exports `as const` vocabularies and derived unions:

- `ISSUE_CODES` / `IssueCode`
- `DATA_RESOLUTIONS` / `DataResolution`
- `VIEW_DIFFS` / `ViewDiff`
- `ISSUE_SEVERITY` / `IssueSeverity`
- `INTERACTION_TYPES` / `InteractionType`
- `INTENT_STATUS` / `IntentStatus`

## Invariants

- `DataSnapshot.values` keys should map to active nodes unless detached.
- `id` is required for all nodes; `key` remains optional in the schema but is recommended for production continuity guarantees.
- `PendingIntent.status` must be from `INTENT_STATUS`.
- `DetachedValue.reason` must be one of `node-removed`, `type-mismatch`, `migration-failed`.
- `ViewNode.type` must match the concrete node shape.

## Import Pattern

Import from the package root only:

```ts
import {
  ViewDefinition,
  DataSnapshot,
  ContinuitySnapshot,
  NodeValue,
  DetachedValue,
  ISSUE_CODES,
} from '@continuum-dev/contract';
```

## Related Docs

- Package overview and examples: `README.md`
- Source type modules: `src/lib/*.ts`

