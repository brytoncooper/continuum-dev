# @continuum/runtime

The stateless reconciliation engine for the Continuum SDK.

Given a new view, a prior view, and prior data, the `reconcile()` function produces a reconciled state along with diffs, resolutions, and issues. It is a pure function with no side effects.

## Installation

```bash
npm install @continuum/runtime
```

## Core Function

### `reconcile()`

```typescript
import { reconcile } from '@continuum/runtime';

function reconcile(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options?: ReconciliationOptions
): ReconciliationResult;
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `newView` | `ViewDefinition` | The new view to reconcile |
| `priorView` | `ViewDefinition \| null` | The prior view (`null` when no prior view is available) |
| `priorData` | `DataSnapshot \| null` | The prior persisted data (`null` when no prior data is available) |
| `options` | `ReconciliationOptions` | Optional configuration |

**Behavior by scenario:**

- **No prior data** (`priorData === null`): returns fresh reconciled state for all nodes (all marked `added`)
- **No prior view** (`priorView === null`): attempts blind carry by node ID when allowed, otherwise starts from empty values
- **Both exist**: runs full reconciliation (context indexing, id/key matching, migration, carry, and removals)

### Usage

```typescript
import { reconcile } from '@continuum/runtime';

const result = reconcile(newView, priorView, priorData, {
  migrationStrategies: {
    fieldNodeId: (nodeId, priorNode, newNode, priorValue) => priorValue,
  },
});

console.log(result.reconciledState);  // DataSnapshot
console.log(result.diffs);      // what changed
console.log(result.resolutions); // per-node resolution records
console.log(result.issues);     // warnings and errors
```

## Types

### ReconciliationResult

```typescript
interface ReconciliationResult {
  reconciledState: DataSnapshot;        // the merged state ready for rendering
  diffs: StateDiff[];                  // what changed during reconciliation
  issues: ReconciliationIssue[];       // warnings, errors, and info
  resolutions: ReconciliationResolution[]; // per-node resolution log
}
```

### ReconciliationOptions

```typescript
interface ReconciliationOptions {
  allowPartialRestore?: boolean;     // allow partial state restoration when detached values apply (default: false)
  allowBlindCarry?: boolean;         // carry state by ID when no prior view exists (default: false)
  migrationStrategies?: Record<string, MigrationStrategy>;  // per-node migration overrides
  strategyRegistry?: Record<string, MigrationStrategy>;     // named strategies for schema migration rules
  clock?: () => number;              // custom clock for timestamps (default: Date.now)
}
```

### StateDiff

```typescript
interface StateDiff {
  nodeId: string;
  type: 'added' | 'removed' | 'migrated' | 'type-changed' | 'restored';
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}
```

### ReconciliationResolution

Per-node record of what happened during reconciliation.

```typescript
interface ReconciliationResolution {
  nodeId: string;                                // node in the new view
  priorId: string | null;                        // matched node from prior view
  matchedBy: 'id' | 'key' | null;               // how the match was found
  priorType: string | null;                      // type in prior view
  newType: string;                               // type in new view
  resolution: 'added' | 'carried' | 'migrated' | 'detached' | 'restored';
  priorValue: unknown;                           // state before reconciliation
  reconciledValue: unknown;                      // state after reconciliation
}
```

### ReconciliationIssue

```typescript
interface ReconciliationIssue {
  severity: 'error' | 'warning' | 'info';
  nodeId?: string;
  message: string;
  code: string;    // one of ISSUE_CODES values
}
```

### MigrationStrategy

```typescript
type MigrationStrategy = (
  nodeId: string,
  priorNode: ViewNode,
  newNode: ViewNode,
  priorValue: unknown
) => unknown;
```

## Context Utilities

Lower-level functions used internally but exported for advanced use cases.

### `buildReconciliationContext()`

Indexes both schemas into lookup maps for efficient matching.

```typescript
function buildReconciliationContext(
  newView: ViewDefinition,
  priorView: ViewDefinition | null
): ReconciliationContext;
```

### `findPriorNode()`

Finds the matching prior node for a new node (by ID first, then by key).

```typescript
function findPriorNode(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null;
```

### `buildPriorValueLookupByIdAndKey()`

Maps prior data values to new node IDs using key-based matching.

```typescript
function buildPriorValueLookupByIdAndKey(
  priorData: DataSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown>;
```

### `determineNodeMatchStrategy()`

Returns how a node match was found (`'id'`, `'key'`, or `null`).

```typescript
function determineNodeMatchStrategy(
  ctx: ReconciliationContext,
  newNode: ViewNode,
  priorNode: ViewNode | null
): 'id' | 'key' | null;
```

## Matching Algorithm

When reconciling a view transition, each node in the new view is processed:

1. **Match by ID** -- look for a prior node with the same `id`
2. **Match by key** -- if no ID match, look for a prior node with the same `key`
3. **No match** -- node is new (`added` resolution) and receives initial value
4. **Type check** -- if matched but types differ, state is detached and issue `TYPE_MISMATCH` is raised
5. **Hash check** -- if types match but hashes differ, attempt migration
6. **Migration** -- check `migrationStrategies[nodeId]`, then `newNode.migrations` + `strategyRegistry`, then fallback to same-type carry
7. **Carry** -- if type and hash match, or migration fallback succeeds, state carries forward
8. **Removed** -- prior nodes not in the new view are logged as removed (`removed` diffs) and may be moved to detached values

## Links

- [Root README](../../README.md)
- [Schema Contract Reference](../../docs/SCHEMA_CONTRACT.md)
