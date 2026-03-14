# ♾️ @continuum-dev/runtime

**The State Reconciliation Engine for Generative UI.** Saving state is easy. Reconciling state across unpredictable AI mutations is hard.

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

## Core Premise: The Ephemerality Gap

The Ephemerality Gap is the mismatch between ephemeral, regenerating interfaces and durable user intent.
Continuum keeps UI structure and user state separate, then uses deterministic reconciliation so user intent survives schema changes.

[![npm version](https://badge.fury.io/js/@continuum-dev%2Fruntime.svg)](https://badge.fury.io/js/@continuum-dev%2Fruntime)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem: AI Forces Reconciliation

In a traditional application, state management is trivial: a field has a static ID, and you map a value to it.

But in **Generative UI**, the AI doesn't just change data-it changes *structure*.

Imagine an AI agent renders a UI for a user. The user starts filling out a text field (`id: "field_123"`). Halfway through, the AI decides to "improve" the layout. It streams an updated UI that moves the field into a new grid, changes the container type, and renames the ID to `id: "grid_item_456"`.

Standard frameworks drop the old node, mount the new node, and the user's input is destroyed. The data wasn't lost because of a bad state store; it was orphaned because **the map between the state and the UI was mutated**.

To fix this, you don't need a better state manager. You need a reconciliation engine.

## The Solution

**Continuum Runtime** is a pure, stateless reconciliation engine designed specifically to solve the continuity problem in AI-generated interfaces.

Given a `priorView`, a `newView`, and the `priorData`, the engine performs deterministic semantic diffing. It matches nodes by stable keys (even when IDs change), executes data migrations, handles deep nesting restructures, and outputs a perfectly reconciled state ready for rendering.

```bash
npm install @continuum-dev/runtime

```

## Core Capabilities

* 🧠 **Semantic Reconciliation:** AI changed the node IDs? Wrapped them in a new `Row` or `Grid`? Continuum reconciles data via stable semantic keys, ensuring state survives massive layout overhauls.
* 🛡️ **Detached State Retention:** If the AI temporarily removes a field, Continuum doesn't throw the data away. It caches it as an "orphaned" value and automatically restores it if the AI brings the field back in a future turn.
* 🔄 **Data Migrations:** Upgrading a simple text `field` to a complex `collection`? Provide migration strategies to transform data payloads seamlessly across view transitions.
* ⚛️ **Pure & Framework Agnostic:** 100% pure TypeScript. Zero I/O side-effects. Use it to power the reconciliation layer of your React, Angular, Vue, or Vanilla JS agents.

---

## Quick Start

Here is how Continuum reconciles state when an AI completely restructures a UI mid-session.

```typescript
import { reconcile } from '@continuum-dev/runtime';

// 1. The old view and the user's current data
const priorView = {
  viewId: 'v1',
  version: '1.0',
  nodes: [{ id: 'random_id_1', key: 'user_email', type: 'field' }]
};

const priorData = {
  values: {
    'random_id_1': { value: 'alice@example.com' } // The user typed this!
  },
  lineage: { timestamp: Date.now(), sessionId: 'session_123', viewId: 'v1', viewVersion: '1.0' }
};

// 2. The AI generates a totally new layout, burying the field in a group and changing the ID.
const newView = {
  viewId: 'v2',
  version: '2.0',
  nodes: [{
    id: 'layout_group',
    type: 'group',
    children: [{ id: 'new_id_99', key: 'user_email', type: 'field' }]
  }]
};

// 3. Reconcile the AI's structural mutation! 🪄
const { reconciledState, diffs, issues, resolutions } = reconcile(
  newView,
  priorView,
  priorData
);

// Continuum reconciled the state using the stable 'user_email' key.
// Your data survived the AI's restructure!
console.log(reconciledState.values['layout_group/new_id_99'].value);
// Output: 'alice@example.com'

```

## Deep Dive: The Reconciliation Pipeline

When you call `reconcile()`, the runtime executes a strict, deterministic pipeline to figure out exactly what the AI did:

Internal architecture reference:
- [Context module flow and contracts](src/lib/context/README.md)

1. **Context Indexing:** Recursively indexes both views into lookup maps by `id` and `key`, using scoped nested paths plus dot-suffix key matching to detect structural shifts.
2. **Node Resolution:** Evaluates every node in the new view:
* **Carry:** Type and Hash match; data moves forward effortlessly.
* **Migrate:** Hash changed; trigger explicit or registry-based migration strategies to reshape the data payload.
* **Detach:** Type mismatch (e.g., a text input became a button); old data is safely stored in `detachedValues` rather than discarded.
* **Restore:** A newly generated node matches the key/type of a previously detached value, reconciling the old data back to life.


3. **Collection Mapping:** Normalizes arrays, enforcing `minItems`/`maxItems` constraints and remapping nested template paths if the AI restructures list items.
4. **Validation:** Runs lightweight constraints checks (`min`, `max`, `pattern`, `required`) to immediately surface data issues caused by the AI's new schema.

## Advanced: Migration Strategies

Sometimes an AI doesn't just move a node; it fundamentally changes its data structure. Continuum allows you to define explicit migration strategies during reconciliation.

```typescript
const result = reconcile(newView, priorView, priorData, {
  migrationStrategies: {
    // If the AI changes the 'status' node schema, run this transformation
    'status': (nodeId, priorNode, newNode, priorValue) => {
       const typedValue = priorValue as { value: string };
       return { value: typedValue.value.toUpperCase() };
    }
  },
  // Or pass a registry of chainable strategies defined by the view AST
  strategyRegistry: {
    'string-to-array': myStringToArrayFunction
  }
});

```

---

## The Continuum Ecosystem

This package is the core engine, but the Continuum SDK provides dedicated framework bindings so you don't have to wire this up manually:

* `@continuum-dev/session` - Stateful manager for conversational UI streams.
* `@continuum-dev/react` - React bindings and component renderer.
* `@continuum-dev/angular` - Angular bindings and directives.

---

## Public API Reference

The runtime barrel file exports:

- `./lib/reconcile.js`
- `./lib/types.js`
- `./lib/context.js`
- `./lib/reconciliation/validator.js`

Most integrations only need `reconcile()`, but advanced applications can use the lower-level APIs for debugging, preflight checks, and custom matching workflows.

### 1) Core Orchestration

#### `reconcile()`

Primary runtime entrypoint. Compares a new view against prior view/data and returns reconciled state plus reconciliation metadata.

```typescript
function reconcile(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options?: ReconciliationOptions
): ReconciliationResult;
```

Use case:
- Call this on every new AI-generated view push to preserve user state across structural mutations.
- Use the returned `diffs`, `issues`, and `resolutions` to power devtools, telemetry, or UI diagnostics.

### 2) Core Types and Interfaces

Exported from `src/lib/types.ts`.

#### `ReconciliationOptions`

Controls runtime behavior and migration extension points.

```typescript
interface ReconciliationOptions {
  allowPartialRestore?: boolean;
  allowBlindCarry?: boolean;
  migrationStrategies?: Record<string, MigrationStrategy>;
  strategyRegistry?: Record<string, MigrationStrategy>;
  clock?: () => number;
}
```

Use case:
- Enable `allowBlindCarry` when you have prior data but no prior view AST.
- Provide `migrationStrategies` or `strategyRegistry` when node schemas evolve across view versions.
- Provide `clock` in tests for deterministic lineage timestamps.

#### `ReconciliationResult`

Full output payload from `reconcile()`.

```typescript
interface ReconciliationResult {
  reconciledState: DataSnapshot;
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  resolutions: ReconciliationResolution[];
}
```

Use case:
- Persist `reconciledState` as your canonical session state.
- Use `issues` as immediate feedback when AI-generated schemas introduce invalid data.

#### `StateDiff`

Represents a single change produced during reconciliation.

```typescript
interface StateDiff {
  nodeId: string;
  type: ViewDiff;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}
```

Use case:
- Render "what changed" timelines in developer tooling.
- Trigger downstream automation only for specific diff types (for example, `migrated` or `removed`).

#### `ReconciliationResolution`

Per-node trace of how a value was resolved.

```typescript
interface ReconciliationResolution {
  nodeId: string;
  priorId: string | null;
  matchedBy: 'id' | 'key' | null;
  priorType: string | null;
  newType: string;
  resolution: DataResolution;
  priorValue: unknown;
  reconciledValue: unknown;
}
```

Use case:
- Explain why a node was carried, migrated, detached, added, or restored.
- Audit matching reliability (`matchedBy: 'id' | 'key'`) over real AI traffic.

#### `ReconciliationIssue`

Structured issue emitted by reconciliation and validation.

```typescript
interface ReconciliationIssue {
  severity: IssueSeverity;
  nodeId?: string;
  message: string;
  code: IssueCode;
}
```

Use case:
- Surface warning/error banners in debugging UIs.
- Build alerting and metrics keyed by `code` and `severity`.

#### `MigrationStrategy`

User-implemented function for transforming payloads when a node schema changes.

```typescript
type MigrationStrategy = (
  nodeId: string,
  priorNode: ViewNode,
  newNode: ViewNode,
  priorValue: unknown
) => unknown;
```

Use case:
- Convert old value shapes into new structures when AI changes a node contract.
- Keep business-critical data continuity through deliberate, explicit transformations.

Note:
- `NodeResolutionAccumulator` is also exported but is primarily an internal accumulator used by the reconciliation loop.

### 3) Context and Matching Utilities (Advanced)

Exported from `src/lib/context.ts`.

#### `buildReconciliationContext()`

Indexes new and prior views into id/key lookup maps used by matching and resolution.

```typescript
function buildReconciliationContext(
  newView: ViewDefinition,
  priorView: ViewDefinition | null
): ReconciliationContext;
```

Use case:
- Build custom reconciliation inspectors or diagnostics outside the main pipeline.
- Precompute matching context once when running specialized custom workflows.

#### `findPriorNode()`

Finds the best prior-view match for a new node using scoped id, key, and suffix fallback rules.

```typescript
function findPriorNode(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null;
```

Use case:
- Debug matching behavior node-by-node.
- Validate whether your semantic key strategy is stable across generated layouts.

#### `buildPriorValueLookupByIdAndKey()`

Creates a lookup map that carries prior values by id and semantic key remapping.

```typescript
function buildPriorValueLookupByIdAndKey(
  priorData: DataSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown>;
```

Use case:
- Reuse runtime value remapping logic in custom reconciliation or simulation tooling.

#### `determineNodeMatchStrategy()`

Returns how a new node matched to prior state (`id`, `key`, or `null`).

```typescript
function determineNodeMatchStrategy(
  ctx: ReconciliationContext,
  newNode: ViewNode,
  priorNode: ViewNode | null
): 'id' | 'key' | null;
```

Use case:
- Instrument matching quality and identify over-reliance on id-only carries.

#### `resolvePriorSnapshotId()`

Resolves a snapshot key to a unique scoped prior node id when possible.

```typescript
function resolvePriorSnapshotId(
  ctx: ReconciliationContext,
  priorId: string
): string | null;
```

Use case:
- Normalize snapshot keys before custom diffing, reconciliation, or migration passes.

#### `findNewNodeByPriorNode()`

Maps a prior node forward to its best new-view candidate by key.

```typescript
function findNewNodeByPriorNode(
  ctx: ReconciliationContext,
  priorNode: ViewNode
): ViewNode | null;
```

Use case:
- Build forward-mapping analyzers for node removals, moves, and restores.

#### `collectDuplicateIssues()`

Scans a view tree for duplicate ids/keys and returns structured issues.

```typescript
function collectDuplicateIssues(nodes: ViewNode[]): ReconciliationIssue[];
```

Use case:
- Run preflight validation on AI-generated views before invoking `reconcile()`.

### 4) Validation

Exported from `src/lib/reconciliation/validator.ts`.

#### `validateNodeValue()`

Validates a node value against view constraints (`required`, numeric bounds, length bounds, pattern).

```typescript
function validateNodeValue(
  node: ViewNode,
  state: NodeValue | undefined
): ReconciliationIssue[];
```

Use case:
- Reuse runtime-consistent validation semantics in custom form flows and pre-submit checks.
- Re-validate values independently when users edit data outside the default reconciliation loop.

## License

MIT © Bryton Cooper
