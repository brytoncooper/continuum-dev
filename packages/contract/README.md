# @continuum/contract

Pure type definitions and constants for Continuum. This package has no runtime behavior and is shared by all packages in the monorepo.

## Installation

```bash
npm install @continuum/contract
```

## Public Surface

Exports from `packages/contract/src/index.ts`:

- `./lib/continuity-snapshot.js`
- `./lib/view-definition.js`
- `./lib/data-snapshot.js`
- `./lib/interactions.js`
- `./lib/constants.js`

## Core Contracts

### ViewDefinition

`ViewDefinition` defines the current UI view shape.

```ts
interface ViewDefinition {
  viewId: string;
  version: string;
  nodes: ViewNode[];
}
```

### ViewNode

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

All node types extend `BaseNode`.

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

### Node Types

#### FieldNode

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

#### GroupNode

```ts
interface GroupNode extends BaseNode {
  type: 'group';
  label?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  children: ViewNode[];
}
```

#### CollectionNode

```ts
interface CollectionNode extends BaseNode {
  type: 'collection';
  label?: string;
  template: ViewNode;
  minItems?: number;
  maxItems?: number;
  defaultValues?: Array<Record<string, unknown>>;
}
```

#### ActionNode

```ts
interface ActionNode extends BaseNode {
  type: 'action';
  intentId: string;
  label: string;
  disabled?: boolean;
}
```

#### PresentationNode

```ts
interface PresentationNode extends BaseNode {
  type: 'presentation';
  contentType: 'text' | 'markdown';
  content: string;
}
```

#### RowNode

```ts
interface RowNode extends BaseNode {
  type: 'row';
  children: ViewNode[];
}
```

#### GridNode

```ts
interface GridNode extends BaseNode {
  type: 'grid';
  columns?: number;
  children: ViewNode[];
}
```

### FieldConstraints

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

### FieldOption

```ts
interface FieldOption {
  value: string;
  label: string;
}
```

### MigrationRule

```ts
interface MigrationRule {
  fromHash: string;
  toHash: string;
  strategyId?: string;
}
```

### getChildNodes

```ts
function getChildNodes(node: ViewNode): ViewNode[];
```

Returns child nodes for recursion:

- `GroupNode.children`
- `RowNode.children`
- `GridNode.children`
- `[template]` for `CollectionNode`
- `[]` for other node types

## Runtime Data Contracts

### DataSnapshot

```ts
interface DataSnapshot {
  values: Record<string, NodeValue>;
  viewContext?: Record<string, ViewContext>;
  lineage: SnapshotLineage;
  valueLineage?: Record<string, ValueLineage>;
  detachedValues?: Record<string, DetachedValue>;
}
```

### NodeValue

```ts
interface NodeValue<T = unknown> {
  value: T;
  suggestion?: T;
  isDirty?: boolean;
  isValid?: boolean;
}
```

### CollectionState

```ts
interface CollectionItemState {
  values: Record<string, NodeValue>;
}

interface CollectionNodeState {
  items: CollectionItemState[];
}
```

### ViewContext

```ts
interface ViewContext {
  scrollX?: number;
  scrollY?: number;
  isExpanded?: boolean;
  isFocused?: boolean;
}
```

### SnapshotLineage

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

### ValueLineage

```ts
interface ValueLineage {
  lastUpdated?: number;
  lastInteractionId?: string;
}
```

### DetachedValue

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

### ContinuitySnapshot

```ts
interface ContinuitySnapshot {
  view: ViewDefinition;
  data: DataSnapshot;
}
```

## Interaction Contracts

### Interaction

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

### PendingIntent

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

### Checkpoint

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

All constants are `as const` objects with derived union types.

### ISSUE_CODES

```ts
NO_PRIOR_DATA;
NO_PRIOR_VIEW;
TYPE_MISMATCH;
NODE_REMOVED;
MIGRATION_FAILED;
UNVALIDATED_CARRY;
VALIDATION_FAILED;
UNKNOWN_NODE;
DUPLICATE_NODE_ID;
DUPLICATE_NODE_KEY;
VIEW_CHILD_CYCLE_DETECTED;
VIEW_MAX_DEPTH_EXCEEDED;
COLLECTION_CONSTRAINT_VIOLATED;
SCOPE_COLLISION;
```

Type: `IssueCode`

### DATA_RESOLUTIONS

```ts
carried;
migrated;
detached;
added;
restored;
```

Type: `DataResolution`

### VIEW_DIFFS

```ts
added;
removed;
migrated;
type - changed;
restored;
```

Type: `ViewDiff`

### ISSUE_SEVERITY

```ts
error;
warning;
info;
```

Type: `IssueSeverity`

### INTERACTION_TYPES

```ts
data - update;
value - change;
view - context - change;
```

Type: `InteractionType`

### INTENT_STATUS

```ts
pending;
validated;
stale;
cancelled;
```

Type: `IntentStatus`

## Notes

- `Interaction.type` is typed as `InteractionType` and validated via shared interaction constants.
- `DataResolution` uses `detached` rather than the old `dropped` wording.
- Prefer additive changes when evolving contracts.

## Minimal Example

```ts
import {
  ViewDefinition,
  DataSnapshot,
  ContinuitySnapshot,
  ISSUE_CODES,
} from '@continuum/contract';

const view: ViewDefinition = {
  viewId: 'loan-application',
  version: '2.1.0',
  nodes: [
    {
      id: 'name',
      type: 'field',
      dataType: 'string',
      label: 'Full Name',
      key: 'fullName',
      hash: 'field:name:v1',
    },
  ],
};

const data: DataSnapshot = {
  values: {
    name: { value: 'Alex' },
  },
  lineage: {
    timestamp: Date.now(),
    sessionId: 'sess-1',
    viewId: view.viewId,
    viewVersion: view.version,
  },
};

const snapshot: ContinuitySnapshot = {
  view,
  data,
};

const issue = ISSUE_CODES.NO_PRIOR_DATA;
```

## Link

- [View Contract Reference](../../docs/SCHEMA_CONTRACT.md)
