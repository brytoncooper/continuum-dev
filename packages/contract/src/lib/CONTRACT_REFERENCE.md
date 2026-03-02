# Continuum Contract: Complete Type Reference

This document is the canonical deep reference for the `@continuum/contract` library's type system.
It explains:

- every exported type, function, and constant
- how those types relate to each other
- lifecycle and data flow expectations
- practical guidance for humans and AI agents that read or generate contract data

The package is intentionally "types + constants only" (with one pure utility function). This means correctness depends on consistent interpretation of these contracts across all consumer packages.

## 1) Package Surface and File Map

The package exports the following modules from `packages/contract/src/index.ts`:

- `./lib/continuity-snapshot.js`
- `./lib/view-definition.js`
- `./lib/data-snapshot.js`
- `./lib/interactions.js`
- `./lib/constants.js`

Primary files and responsibilities:

- `view-definition.ts`: view structure, node tree, field constraints, and migration metadata contracts
- `data-snapshot.ts`: runtime user data, per-value lineage, detached values, and view context contracts
- `continuity-snapshot.ts`: composed `view + data` root contract
- `interactions.ts`: event/intent/checkpoint contracts around sessions
- `constants.ts`: stable enumerations as `as const` objects + union types

## 2) High-Level Domain Model

At a high level, the domain model is:

1. **ViewDefinition defines what nodes exist and what they look like**
2. **DataSnapshot stores values for those nodes**
3. **ContinuitySnapshot binds view and data into one atomic object**
4. **Interactions and pending intents describe change events over time**
5. **Constants provide stable vocabularies used by events, diffs, and issue reporting**

Mental model:

- `ViewDefinition` is the "shape contract" — a versioned tree of typed nodes
- `DataSnapshot` is the "data instance" — values, lineage, detached values, and view context
- `ContinuitySnapshot` is the "state of the world at time T"
- `Interaction` and `PendingIntent` are "things that happened / are waiting"
- `Checkpoint` is a rewindable durable save point

## 3) Type-By-Type Reference

### 3.1 `ViewDefinition`

Defined in `view-definition.ts`.

```ts
interface ViewDefinition {
  viewId: string;
  version: string;
  nodes: ViewNode[];
}
```

Field semantics:

- `viewId`: stable logical identity of the view family (e.g. one product flow)
- `version`: view revision identifier for ordering and compatibility checks
- `nodes`: top-level node tree roots

Usage notes:

- `viewId + version` together identify one specific view revision
- `nodes` is recursive through `GroupNode.children` and `CollectionNode.template`

### 3.2 `ViewNode` (discriminated union)

Defined in `view-definition.ts`.

```ts
type ViewNode = FieldNode | GroupNode | CollectionNode | ActionNode | PresentationNode;
```

All five node types extend `BaseNode`:

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

`BaseNode` field semantics:

- `id`: required per-version node identifier; used as data key
- `type`: discriminant tag (`'field'` | `'group'` | `'collection'` | `'action'` | `'presentation'`)
- `key`: optional semantic identity across versions; used for matching during migration
- `hidden`: visibility flag
- `hash`: structural fingerprint for compatibility/migration decisions
- `migrations`: valid transitions between prior and next hashes

### 3.3 `FieldNode`

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
}
```

Purpose:

- represents a data-bearing input node
- `dataType` declares the expected value domain
- `constraints` provides portable validation metadata via `FieldConstraints`
- `defaultValue` is the initial data payload for this node

### 3.4 `GroupNode`

```ts
interface GroupNode extends BaseNode {
  type: 'group';
  label?: string;
  children: ViewNode[];
}
```

Purpose:

- structural container that holds an ordered list of child nodes
- `children` is the primary recursion point for the node tree

### 3.5 `CollectionNode`

```ts
interface CollectionNode extends BaseNode {
  type: 'collection';
  label?: string;
  template: ViewNode;
  minItems?: number;
  maxItems?: number;
}
```

Purpose:

- repeatable item pattern defined by a single `template` node
- `minItems`/`maxItems` constrain cardinality
- `template` is the second recursion point (single child rather than array)

### 3.6 `ActionNode`

```ts
interface ActionNode extends BaseNode {
  type: 'action';
  intentId: string;
  label: string;
  disabled?: boolean;
}
```

Purpose:

- represents a triggerable action bound to an intent
- `intentId` links this node to the intent it fires (see `PendingIntent.intentId`)
- `label` is required UI text for the action
- `disabled` controls interactivity

### 3.7 `PresentationNode`

```ts
interface PresentationNode extends BaseNode {
  type: 'presentation';
  contentType: 'text' | 'markdown';
  content: string;
}
```

Purpose:

- read-only content node (instructions, descriptions, legal text)
- `contentType` signals rendering mode
- carries no user data

### 3.8 `FieldConstraints`

Defined in `view-definition.ts`.

```ts
interface FieldConstraints {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}
```

Purpose:

- normalized validation metadata independent of any specific UI framework
- supports both numeric (`min`/`max`) and string (`minLength`/`maxLength`) constraints
- `pattern` encodes regex as string for portability/serialization

### 3.9 `MigrationRule`

Defined in `view-definition.ts`.

```ts
interface MigrationRule {
  fromHash: string;
  toHash: string;
  strategyId?: string;
}
```

Purpose:

- declares an allowed data-shape transition when a node changes structure

Field semantics:

- `fromHash`: old node hash
- `toHash`: new node hash
- `strategyId`: optional migration strategy selector in consumer code

### 3.10 `getChildNodes`

Defined in `view-definition.ts`.

```ts
function getChildNodes(node: ViewNode): ViewNode[]
```

Purpose:

- pure utility for traversing the node tree
- returns `children` for `GroupNode`, `[template]` for `CollectionNode`, `[]` for all others

### 3.11 `DataSnapshot`

Defined in `data-snapshot.ts`.

```ts
interface DataSnapshot {
  values: Record<string, NodeValue>;
  viewContext?: Record<string, ViewContext>;
  lineage: SnapshotLineage;
  valueLineage?: Record<string, ValueLineage>;
  detachedValues?: Record<string, DetachedValue>;
}
```

Field semantics:

- `values`: map of data entries keyed by node identity (commonly the node `id`)
- `viewContext`: optional per-node UI state (scroll position, expansion, focus)
- `lineage`: required global snapshot provenance
- `valueLineage`: optional per-value provenance metadata
- `detachedValues`: optional preserved values that no longer map cleanly to the current view

Why `detachedValues` matters:

- protects user data during view evolution when nodes are removed or incompatible
- allows delayed reconciliation, inspection, rollback, or manual resolution

### 3.12 `NodeValue`

Defined in `data-snapshot.ts`.

```ts
interface NodeValue<T = unknown> {
  value: T;
  isDirty?: boolean;
  isValid?: boolean;
}
```

Purpose:

- wraps any node's data payload with modification and validity tracking
- generic `T` defaults to `unknown` for maximum flexibility

### 3.13 `ViewContext`

Defined in `data-snapshot.ts`.

```ts
interface ViewContext {
  scrollX?: number;
  scrollY?: number;
  isExpanded?: boolean;
  isFocused?: boolean;
}
```

Purpose:

- per-node UI interaction state (position, expansion, focus)
- separated from data values to keep user data clean

### 3.14 `SnapshotLineage`

Defined in `data-snapshot.ts`.

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

Purpose:

- records global provenance for a data snapshot

Field semantics:

- `timestamp`: snapshot creation/update time
- `sessionId`: session affinity
- `viewId` / `viewVersion` / `viewHash`: view provenance used for compatibility checks
- `lastInteractionId`: event linkage for traceability

### 3.15 `ValueLineage`

Defined in `data-snapshot.ts`.

```ts
interface ValueLineage {
  lastUpdated?: number;
  lastInteractionId?: string;
}
```

Purpose:

- per-key observability and lineage metadata

### 3.16 `DetachedValue`

Defined in `data-snapshot.ts`.

```ts
interface DetachedValue {
  value: unknown;
  previousNodeType: string;
  key?: string;
  detachedAt: number;
  viewVersion: string;
  reason: 'node-removed' | 'type-mismatch' | 'migration-failed';
}
```

Purpose:

- retains values that were previously valid but cannot be placed safely in current active `values`

Field semantics:

- `value`: original data payload
- `previousNodeType`: prior node type context (e.g. `'field'`, `'group'`)
- `key`: optional semantic identifier across versions
- `detachedAt`: timestamp of detachment event
- `viewVersion`: view version at time of detachment
- `reason`: bounded reason taxonomy for downstream handling/reporting

### 3.17 `ContinuitySnapshot`

Defined in `continuity-snapshot.ts`.

```ts
interface ContinuitySnapshot {
  view: ViewDefinition;
  data: DataSnapshot;
}
```

Role:

- root aggregate type representing one coherent point-in-time continuity state
- combines structure (`view`) with data (`data`) atomically

### 3.18 `Interaction`

Defined in `interactions.ts`.

```ts
interface Interaction {
  interactionId: string;
  sessionId: string;
  nodeId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  viewVersion: string;
}
```

Role:

- immutable event describing one user/system interaction

Field semantics:

- `interactionId`: event id
- `sessionId`: session partition
- `nodeId`: target node
- `type`: interaction category (often aligned with `INTERACTION_TYPES`, but typed as `string` for extensibility)
- `payload`: event data
- `timestamp`: event time
- `viewVersion`: view version observed at event time

### 3.19 `PendingIntent`

Defined in `interactions.ts`.

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

Role:

- queued command/work item awaiting validation or finalization

Field semantics:

- `intentId`: unique identifier for this intent instance
- `nodeId`: originating node (see `ActionNode.intentId` linkage)
- `intentName`: the name/type of intent being requested
- `payload`: intent data
- `queuedAt`: timestamp when the intent was queued
- `viewVersion`: view version at queue time
- `status`: must be one of the `INTENT_STATUS` values via `IntentStatus` union

### 3.20 `Checkpoint`

Defined in `interactions.ts`.

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

Role:

- durable restore point in an interaction timeline

Field semantics:

- `checkpointId`: unique identifier for this checkpoint
- `sessionId`: session partition
- `snapshot`: full recoverable continuity snapshot
- `eventIndex`: sequence location in the event stream
- `timestamp`: checkpoint creation time
- `trigger`: checkpoint source (`auto` system-generated or `manual` user/tool generated)

## 4) Constant Vocabularies

All constants in `constants.ts` are defined as `as const` objects, then converted to exact union types.
This pattern gives:

- stable runtime values
- strict compile-time value safety
- single-source truth for allowed literals

### 4.1 `ISSUE_CODES` and `IssueCode`

Values:

- `NO_PRIOR_DATA`
- `NO_PRIOR_VIEW`
- `TYPE_MISMATCH`
- `NODE_REMOVED`
- `MIGRATION_FAILED`
- `UNVALIDATED_CARRY`
- `VALIDATION_FAILED`
- `UNKNOWN_NODE`
- `DUPLICATE_NODE_ID`
- `DUPLICATE_NODE_KEY`
- `COLLECTION_CONSTRAINT_VIOLATED`
- `SCOPE_COLLISION`

Type:

- `IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES]`

### 4.2 `DATA_RESOLUTIONS` and `DataResolution`

Values:

- `carried`
- `migrated`
- `detached`
- `added`
- `restored`

Purpose:

- describes the outcome of reconciling a data value against a changed view
- `detached` replaces the former "dropped" concept — values are preserved rather than discarded

### 4.3 `VIEW_DIFFS` and `ViewDiff`

Values:

- `added`
- `removed`
- `migrated`
- `type-changed`
- `restored`

Purpose:

- describes how a node changed between two view versions
- used in change summary and diff reporting

### 4.4 `ISSUE_SEVERITY` and `IssueSeverity`

Values:

- `error`
- `warning`
- `info`

### 4.5 `INTERACTION_TYPES` and `InteractionType`

Values:

- `data-update`
- `value-change`
- `view-context-change`

Note:

- `Interaction.type` is currently `string`, not `InteractionType`
- consumers can still choose to constrain to `InteractionType` for stricter behavior
- `view-context-change` covers updates to `ViewContext` entries

### 4.6 `INTENT_STATUS` and `IntentStatus`

Values:

- `pending`
- `validated`
- `stale`
- `cancelled`

Direct usage:

- `PendingIntent.status: IntentStatus`

## 5) Relationship Graph

Dependency chain by type reference:

```
ContinuitySnapshot
├── view: ViewDefinition
│   └── nodes: ViewNode[]
│       ├── FieldNode ─── constraints?: FieldConstraints
│       ├── GroupNode ─── children: ViewNode[]  (recursion)
│       ├── CollectionNode ─── template: ViewNode  (recursion)
│       ├── ActionNode
│       └── PresentationNode
│       (all extend BaseNode ─── migrations?: MigrationRule[])
└── data: DataSnapshot
    ├── values: Record<string, NodeValue>
    ├── lineage: SnapshotLineage
    ├── valueLineage?: Record<string, ValueLineage>
    ├── detachedValues?: Record<string, DetachedValue>
    └── viewContext?: Record<string, ViewContext>

Checkpoint ─── snapshot: ContinuitySnapshot
PendingIntent ─── status: IntentStatus
ActionNode.intentId ──links-to── PendingIntent.intentId
```

Flat reference list:

- `ContinuitySnapshot -> ViewDefinition`
- `ContinuitySnapshot -> DataSnapshot`
- `ViewDefinition -> ViewNode[]`
- `ViewNode = FieldNode | GroupNode | CollectionNode | ActionNode | PresentationNode`
- `BaseNode -> MigrationRule[]`
- `FieldNode -> FieldConstraints`
- `GroupNode -> ViewNode[] (children recursion)`
- `CollectionNode -> ViewNode (template recursion)`
- `DataSnapshot -> Record<string, NodeValue>`
- `DataSnapshot -> SnapshotLineage`
- `DataSnapshot -> Record<string, ValueLineage>`
- `DataSnapshot -> Record<string, DetachedValue>`
- `DataSnapshot -> Record<string, ViewContext>`
- `Checkpoint -> ContinuitySnapshot`
- `PendingIntent -> IntentStatus`

## 6) Data Flow and Lifecycle Connections

Typical continuity lifecycle:

1. A `ViewDefinition` is published (`viewId`, `version`, `nodes`)
2. User/session data is captured in `DataSnapshot.values` as `NodeValue` entries
3. Combined as `ContinuitySnapshot` for storage/transport
4. User events are emitted as `Interaction`
5. Commands are tracked as `PendingIntent` with `IntentStatus`
6. At intervals, system stores `Checkpoint` with full `ContinuitySnapshot`
7. View evolution may carry, migrate, or detach values:
   - successful mapping remains in `values`
   - incompatible values are placed in `detachedValues` with a `reason`
   - issue/reporting systems use `ISSUE_CODES`, `DATA_RESOLUTIONS`, and `VIEW_DIFFS`
8. `ViewContext` entries track per-node UI state independently from data values

## 7) Invariants and Consumer Expectations

The following are not enforced by runtime code in this package, but consumers should treat them as contract invariants:

- `SnapshotLineage.sessionId`, `Interaction.sessionId`, and `Checkpoint.sessionId` refer to the same session namespace
- `DataSnapshot.values` keys should match active node identities in `ViewDefinition.nodes` unless explicitly detached
- `SnapshotLineage.viewVersion` should match (or intentionally trail) `ViewDefinition.version` when snapshot and view are paired
- `lastInteractionId` fields should reference valid `Interaction.interactionId` values when present
- `PendingIntent.status` must only use `INTENT_STATUS` values
- `DetachedValue.reason` must stay within the three allowed literals (`node-removed`, `type-mismatch`, `migration-failed`)
- `FieldNode.dataType` must be one of `'string'`, `'number'`, `'boolean'`
- `ViewNode.type` discriminant and actual interface shape must be consistent

## 8) Compatibility and Evolution Guidance

When evolving view or data contracts:

- prefer additive optional fields over breaking required-field changes
- use `hash` + `migrations` metadata on `BaseNode` to keep transitions explicit
- use `detachedValues` as a safety net instead of destructive data drops
- keep constant vocabularies append-only when possible; renaming literals is high-risk
- if narrowing `Interaction.type` to `InteractionType` in future, evaluate all producers first
- new node types should extend `BaseNode` and be added to the `ViewNode` union

## 9) Practical Usage Patterns

Recommended producer behavior:

- always stamp `timestamp` fields in a consistent unit across the system
- set `SnapshotLineage.viewId/viewVersion` whenever view identity is known
- include `valueLineage` for auditability in systems with replay/debug needs
- use `key` in `BaseNode` where cross-version semantic matching matters
- use `getChildNodes()` for tree traversal instead of manual type-checking

Recommended consumer behavior:

- validate that `view` and `data.lineage.viewVersion` are compatible before replay
- preserve unknown `NodeValue` records instead of dropping them
- route unknown issue/diff/resolution literals to fallback handlers rather than crashing
- treat `ViewContext` as ephemeral UI state — do not rely on it for business logic

## 10) AI-Focused Reading and Generation Notes

If an AI agent is generating or transforming contract objects:

- treat `ViewDefinition` as authoritative structure
- do not invent non-listed `DetachedValue.reason` values
- prefer `INTENT_STATUS`/`INTERACTION_TYPES`/`DATA_RESOLUTIONS` constants to avoid typo drift
- respect the `ViewNode` discriminated union — always set `type` consistently with the interface shape
- never delete user values silently during view mismatch; move to `detachedValues` with clear `reason`
- when generating `FieldNode`, always include `dataType`
- when generating `ActionNode`, always include both `intentId` and `label`
- when generating `PresentationNode`, always include both `contentType` and `content`
- use `getChildNodes()` rather than switch-casing on node type manually

## 11) Quick Cross-Reference Table

| Type / Constant | File | Core Purpose | Key Connections |
| --- | --- | --- | --- |
| `ViewDefinition` | `view-definition.ts` | Root view definition | Contains `ViewNode[]` |
| `ViewNode` | `view-definition.ts` | Discriminated union of all node types | `FieldNode \| GroupNode \| CollectionNode \| ActionNode \| PresentationNode` |
| `BaseNode` | `view-definition.ts` | Shared node fields | Extended by all five node types; holds `MigrationRule[]` |
| `FieldNode` | `view-definition.ts` | Data-bearing input node | Uses `FieldConstraints`; has `dataType` |
| `GroupNode` | `view-definition.ts` | Structural container | Recursive `children: ViewNode[]` |
| `CollectionNode` | `view-definition.ts` | Repeatable item pattern | Recursive `template: ViewNode` |
| `ActionNode` | `view-definition.ts` | Triggerable action | `intentId` links to `PendingIntent` |
| `PresentationNode` | `view-definition.ts` | Read-only content | `contentType` + `content` |
| `FieldConstraints` | `view-definition.ts` | Validation metadata | Attached to `FieldNode` |
| `MigrationRule` | `view-definition.ts` | Hash transition descriptor | Attached to any `BaseNode` |
| `getChildNodes` | `view-definition.ts` | Tree traversal utility | Returns child `ViewNode[]` for group/collection |
| `DataSnapshot` | `data-snapshot.ts` | Runtime data container | Holds `values`, `lineage`, optional metadata/detached values/view context |
| `NodeValue<T>` | `data-snapshot.ts` | Node data wrapper | Used by `DataSnapshot.values` |
| `ViewContext` | `data-snapshot.ts` | Per-node UI state | Optional map on `DataSnapshot` |
| `SnapshotLineage` | `data-snapshot.ts` | Snapshot provenance | Aligns with view and interaction ids |
| `ValueLineage` | `data-snapshot.ts` | Per-value provenance | Optional map on `DataSnapshot` |
| `DetachedValue` | `data-snapshot.ts` | Retained incompatible value | Keeps reasoned detachment context |
| `ContinuitySnapshot` | `continuity-snapshot.ts` | Atomic view+data | Used in checkpoints and transport |
| `Interaction` | `interactions.ts` | Event record | Links session/node/viewVersion |
| `PendingIntent` | `interactions.ts` | Queued intent | `status: IntentStatus`; `intentId` links to `ActionNode` |
| `Checkpoint` | `interactions.ts` | Restore point | Embeds `ContinuitySnapshot` |
| `ISSUE_CODES` / `IssueCode` | `constants.ts` | Issue taxonomy | Used by validation/migration systems |
| `DATA_RESOLUTIONS` / `DataResolution` | `constants.ts` | Data reconciliation taxonomy | Used in carry/migrate/detach reporting |
| `VIEW_DIFFS` / `ViewDiff` | `constants.ts` | View diff taxonomy | Used in change summaries |
| `ISSUE_SEVERITY` / `IssueSeverity` | `constants.ts` | Severity taxonomy | Used in issue reporting |
| `INTERACTION_TYPES` / `InteractionType` | `constants.ts` | Interaction taxonomy | Suggested for `Interaction.type` values |
| `INTENT_STATUS` / `IntentStatus` | `constants.ts` | Pending intent status taxonomy | Bound to `PendingIntent.status` |

## 12) Example Composite Object

```ts
const example: ContinuitySnapshot = {
  view: {
    viewId: 'application-flow',
    version: '2.1.0',
    nodes: [
      {
        id: 'applicant-info',
        type: 'group',
        key: 'applicant',
        label: 'Applicant Information',
        children: [
          {
            id: 'fullName',
            type: 'field',
            key: 'applicant.fullName',
            dataType: 'string',
            label: 'Full Name',
            placeholder: 'Enter your full name',
            hash: 'field:string:v2',
            constraints: { required: true, minLength: 2, maxLength: 120 },
          },
          {
            id: 'age',
            type: 'field',
            key: 'applicant.age',
            dataType: 'number',
            label: 'Age',
            hash: 'field:number:v1',
            constraints: { required: true, min: 18, max: 120 },
          },
        ],
      },
      {
        id: 'terms',
        type: 'presentation',
        contentType: 'markdown',
        content: '**Please review** the [terms of service](/terms).',
      },
      {
        id: 'submit',
        type: 'action',
        intentId: 'submit-application',
        label: 'Submit Application',
      },
    ],
  },
  data: {
    values: {
      fullName: { value: 'Jordan Lee', isDirty: true, isValid: true },
      age: { value: 28, isDirty: true, isValid: true },
    },
    viewContext: {
      'applicant-info': { isExpanded: true },
    },
    lineage: {
      timestamp: 1740700800000,
      sessionId: 'sess-123',
      viewId: 'application-flow',
      viewVersion: '2.1.0',
      lastInteractionId: 'evt-9',
    },
    valueLineage: {
      fullName: { lastUpdated: 1740700800000, lastInteractionId: 'evt-9' },
      age: { lastUpdated: 1740700790000, lastInteractionId: 'evt-7' },
    },
    detachedValues: {
      middleName: {
        value: 'A.',
        previousNodeType: 'field',
        key: 'applicant.middleName',
        detachedAt: 1740700750000,
        viewVersion: '2.0.0',
        reason: 'node-removed',
      },
    },
  },
};
```

This example demonstrates:

- view and data version alignment via `lineage.viewVersion` matching `view.version`
- a `GroupNode` with `FieldNode` children showing the recursive node tree
- `PresentationNode` for read-only content and `ActionNode` for triggerable intents
- node-id keyed data values with `NodeValue` wrappers
- `viewContext` tracking UI state separately from data
- per-value lineage for auditability
- a `DetachedValue` preserving data from a removed node with provenance
- minimal required shape for valid composition
