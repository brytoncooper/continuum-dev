# @continuum/runtime

The stateless reconciliation engine for the Continuum SDK.

Given a new schema, a prior schema, and prior state, the `reconcile()` function produces a reconciled state along with diffs, traces, and issues. It is a pure function with no side effects.

## Installation

```bash
npm install @continuum/runtime
```

## Core Function

### `reconcile()`

```typescript
import { reconcile } from '@continuum/runtime';

function reconcile(
  newSchema: SchemaSnapshot,
  priorSchema: SchemaSnapshot | null,
  priorState: StateSnapshot | null,
  options?: ReconciliationOptions
): ReconciliationResult;
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `newSchema` | `SchemaSnapshot` | The new UI schema to reconcile against |
| `priorSchema` | `SchemaSnapshot \| null` | The schema the prior state was built against (`null` on first push) |
| `priorState` | `StateSnapshot \| null` | The user's existing state (`null` on first push) |
| `options` | `ReconciliationOptions` | Optional configuration |

**Behavior by scenario:**

- **No prior state** (`priorState === null`): returns fresh empty state for all components (all marked `added`)
- **No prior schema** (`priorSchema === null`): attempts blind carry by matching component IDs, or drops all state
- **Both exist**: runs the full reconciliation pipeline (match, diff, migrate, carry)

### Usage

```typescript
import { reconcile } from '@continuum/runtime';

const result = reconcile(newSchema, priorSchema, priorState, {
  migrationStrategies: {
    email: (id, oldDef, newDef, oldState) => oldState,
  },
});

console.log(result.reconciledState);  // StateSnapshot
console.log(result.diffs);            // what changed
console.log(result.trace);            // per-component action log
console.log(result.issues);           // warnings and errors
```

## Types

### ReconciliationResult

```typescript
interface ReconciliationResult {
  reconciledState: StateSnapshot;      // the merged state ready for rendering
  diffs: StateDiff[];                  // what changed during reconciliation
  issues: ReconciliationIssue[];       // warnings, errors, and info
  trace: ReconciliationTrace[];        // per-component action log
}
```

### ReconciliationOptions

```typescript
interface ReconciliationOptions {
  strictMode?: boolean;              // reject untrusted carries (default: false)
  allowPartialRestore?: boolean;     // allow partial state restoration (default: false)
  allowBlindCarry?: boolean;         // carry state by ID when no prior schema exists (default: true)
  migrationStrategies?: Record<string, MigrationStrategy>;  // per-component migration overrides
  strategyRegistry?: Record<string, MigrationStrategy>;     // named strategies referenced by MigrationRule.strategyId
  clock?: () => number;              // custom clock for timestamps (default: Date.now)
}
```

### StateDiff

```typescript
interface StateDiff {
  componentId: string;
  type: 'added' | 'removed' | 'modified' | 'migrated' | 'type-changed';
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}
```

### ReconciliationTrace

Per-component record of what happened during reconciliation.

```typescript
interface ReconciliationTrace {
  componentId: string;                           // component in the new schema
  priorId: string | null;                        // matched component from prior schema
  matchedBy: 'id' | 'key' | null;               // how the match was found
  priorType: string | null;                      // type in prior schema
  newType: string;                               // type in new schema
  action: 'carried' | 'migrated' | 'dropped' | 'added';
  priorValue: unknown;                           // state before reconciliation
  reconciledValue: unknown;                      // state after reconciliation
}
```

### ReconciliationIssue

```typescript
interface ReconciliationIssue {
  severity: 'error' | 'warning' | 'info';
  componentId?: string;
  message: string;
  code: string;    // one of ISSUE_CODES values
}
```

### MigrationStrategy

```typescript
type MigrationStrategy = (
  componentId: string,
  oldSchema: ComponentDefinition,
  newSchema: ComponentDefinition,
  oldState: unknown
) => unknown | null;   // return null to signal migration failure
```

## Context Utilities

Lower-level functions used internally but exported for advanced use cases.

### `buildReconciliationContext()`

Indexes both schemas into lookup maps for efficient matching.

```typescript
function buildReconciliationContext(
  newSchema: SchemaSnapshot,
  priorSchema: SchemaSnapshot | null
): ReconciliationContext;
```

### `findPriorComponent()`

Finds the matching prior component for a new component (by ID first, then by key).

```typescript
function findPriorComponent(
  ctx: ReconciliationContext,
  newComponent: ComponentDefinition
): ComponentDefinition | null;
```

### `buildPriorValueMap()`

Maps prior state values to new component IDs using key-based matching.

```typescript
function buildPriorValueMap(
  priorState: StateSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown>;
```

### `determineMatchType()`

Returns how a match was found (`'id'`, `'key'`, or `null`).

```typescript
function determineMatchType(
  ctx: ReconciliationContext,
  newComponent: ComponentDefinition,
  priorComponent: ComponentDefinition | null
): 'id' | 'key' | null;
```

## Matching Algorithm

When reconciling a schema transition, each component in the new schema is processed:

1. **Match by ID** -- look for a prior component with the same `id`
2. **Match by key** -- if no ID match, look for a prior component with the same `key`
3. **No match** -- component is new (`added` trace, empty state)
4. **Type check** -- if matched but types differ, state is **dropped** (`TYPE_MISMATCH` issue)
5. **Hash check** -- if types match but hashes differ, attempt migration
6. **Migration** -- check `migrationStrategies[componentId]`, then `MigrationRule` + `strategyRegistry`, then fallback (carry as-is if same type)
7. **Carry** -- if type and hash match, state carries forward unchanged
8. **Removed** -- prior components not in the new schema are logged as `COMPONENT_REMOVED`

## Links

- [Root README](../../README.md)
- [Schema Contract Reference](../../docs/SCHEMA_CONTRACT.md)
