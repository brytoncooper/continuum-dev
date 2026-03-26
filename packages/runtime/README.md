# @continuum-dev/runtime

```bash
npm install @continuum-dev/runtime
```

## Why It Exists

Generated and server-driven UIs change structure over time.

A field can move under a new container, get renamed, or come back later in a slightly different shape. When that happens, users still expect their intent to survive. They do not care that the UI tree changed.

`@continuum-dev/runtime` exists to close that gap. It carries forward user-entered state when continuity is defensible, detaches state when carry would be unsafe, and restores detached state when compatible structure returns.

## How It Works

The runtime always compares three things:

- the next view,
- the prior view,
- the prior canonical data snapshot.

From there it uses fixed rules:

1. match by scoped id,
2. then by unique `semanticKey`,
3. then by scoped `key`.

If a match is safe, it carries the value. If a node changed shape and you provided a migration strategy, it migrates the value. If carry would be unsafe, it detaches the value instead of forcing it into the wrong node. If compatible structure appears again later, that detached value can be restored.

Every structural update returns:

- the next canonical snapshot,
- `diffs` describing what changed,
- `resolutions` explaining how each node was handled,
- `issues` describing ambiguity, validation, or safety boundaries.

## What It Is

`@continuum-dev/runtime` is a headless TypeScript runtime for view continuity.

Most users only need these entrypoints:

```ts
import {
  applyContinuumNodeValueWrite,
  applyContinuumViewUpdate,
  decideContinuumNodeValueWrite,
  reconcile,
} from '@continuum-dev/runtime';
```

The canonical snapshot shape is:

- `values`
- `lineage`
- optional `valueLineage`
- optional `detachedValues`

Legacy view-only fields such as `viewContext` are not part of the runtime contract.

## Simplest Way To Use It

Most apps should start with `applyContinuumViewUpdate(...)` for structural changes and `applyContinuumNodeValueWrite(...)` for user edits.

Keep these four things in your app state:

- the current `view`,
- the current canonical `data`,
- a stable `sessionId`,
- a monotonic clock or timestamp source.

### Minimal Flow

```ts
import {
  applyContinuumNodeValueWrite,
  applyContinuumViewUpdate,
} from '@continuum-dev/runtime';

// Keep the latest rendered view and canonical runtime snapshot.
let view = null;
let data = null;

// Use one stable session id and a monotonic timestamp source.
const sessionId = 'session-1';
let tick = 0;
const now = () => ++tick;

// First structural mount: no prior view or data yet.
const firstView = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'email',
      type: 'field',
      dataType: 'string',
      semanticKey: 'person.email',
    },
  ],
};

// `mounted` contains the runtime-ready result of the first mount:
// the normalized view, canonical data snapshot, and reconciliation metadata.
const mounted = applyContinuumViewUpdate({
  baseView: view,
  baseData: data,
  nextView: firstView,
  sessionId,
  clock: now,
});

// Persist the returned canonical state.
view = mounted.view;
data = mounted.data;

// User input writes directly into canonical snapshot state.
const typed = applyContinuumNodeValueWrite({
  view,
  data,
  nodeId: 'email',
  value: { value: 'alice@example.com', isDirty: true },
  sessionId,
  timestamp: now(),
  interactionId: 'typing-1',
});

if (typed.kind === 'applied') {
  data = typed.data;
}

// Later the UI structure changes, but the semantic meaning stays the same.
const nextView = {
  viewId: 'profile',
  version: '2',
  nodes: [
    {
      id: 'contact',
      type: 'group',
      children: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          semanticKey: 'person.email',
        },
      ],
    },
  ],
};

const updated = applyContinuumViewUpdate({
  baseView: view,
  baseData: data,
  nextView,
  sessionId,
  clock: now,
});

// Persist the new view and reconciled data for the next render/update cycle.
view = updated.view;
data = updated.data;
```

### Normal Runtime Order

The important mental model is:

1. start with your current `view` and `data`,
2. apply a structural update with `applyContinuumViewUpdate(...)`,
3. persist the returned `view` and `data`,
4. apply direct user writes against that latest persisted state,
5. persist the returned `data`,
6. use that latest `view` and `data` as the inputs to the next structural update.

In other words, each runtime call produces the state that the next runtime call should start from.

### About `clock`

The runtime uses timestamps to keep lineage ordered over time.

That matters because the snapshot is not just current values. It also records when a structural update or direct write happened.

For structural updates:

- `applyContinuumViewUpdate(...)` accepts `clock: () => number`
- the first mount needs a clock because there is no prior lineage timestamp yet
- later structural updates can derive the next timestamp from `priorData.lineage.timestamp + 1` if you omit `clock`
- even so, using one consistently is usually easier to reason about

For direct writes:

- `applyContinuumNodeValueWrite(...)` requires a numeric `timestamp`
- the simplest pattern is to use the same time source for both structural updates and direct writes

The safest clock is monotonic, meaning it only moves forward.

Good choices:

- a simple in-memory counter for demos or client-only flows
- a server-issued sequence number
- a database revision number
- any app-level counter that guarantees each new event gets a larger number than the last one

Simple example:

```ts
let tick = 0;
const now = () => ++tick;
```

This is why the minimal flow uses `now()` for both:

- `clock: now` during structural updates
- `timestamp: now()` during direct writes

That gives every runtime event a clear ordering.

### What Is Required

For the normal runtime path you need:

- `sessionId`
  - used in lineage
- `clock` for `applyContinuumViewUpdate(...)`
  - required on first mount, and recommended on later structural updates so event ordering stays explicit
- `timestamp` for `applyContinuumNodeValueWrite(...)`
  - required because direct writes update lineage
- the previous `view` and `data`
  - required if you want continuity across structural changes

### What To Persist

After each call, persist:

- the returned `view`,
- the returned canonical `data`.

If you care about auditability or debugging, also inspect:

- `issues`
- `diffs`
- `resolutions`

## Other Options

### Pure Structural Reconciliation

If you already manage view patching yourself and want the low-level engine, use `reconcile(...)` directly.

```ts
let tick = 0;
const now = () => ++tick;

const result = reconcile({
  newView,
  priorView,
  priorData,
  options: {
    clock: now,
  },
});
```

`reconcile(...)` is pure structural reconciliation. It does not patch views for you.

### Patch Or Stream A View

If your view arrives in pieces, use `@continuum-dev/runtime/view-stream`:

- `patch`
- `insert-node`
- `move-node`
- `wrap-nodes`
- `replace-node`
- `remove-node`
- `append-content`

The normal pattern is:

1. apply one streamed part with `applyContinuumViewStreamPart(...)`,
2. feed the resulting `view` into `applyContinuumViewUpdate(...)`.

### Transform During A Structural Update

`applyContinuumViewUpdate(...)` also accepts `transformPlan`.

Use this when reconciliation should happen first, but you also want a guided post-reconcile reshape such as merging source fields into a new target field.

### Programmatic Or Non-User Edits

Use `decideContinuumNodeValueWrite(...)` before applying a non-user write.

It returns:

- `apply`
  - safe to write immediately
- `proposal`
  - the current value is protected by `isDirty` or `isSticky`
- `unknown-node`
  - the target node could not be resolved

This is useful for AI suggestions, autofill, or system-authored edits that should not silently overwrite user input.

### Validation, Lookup, And Diagnostics

Explicit subpaths are available for narrower needs:

- `@continuum-dev/runtime/validator`
  - `validateNodeValue`
- `@continuum-dev/runtime/node-lookup`
  - canonical id lookup helpers
- `@continuum-dev/runtime/canonical-snapshot`
  - canonical snapshot sanitization
- `@continuum-dev/runtime/restore-candidates`
  - heuristic suggestions for detached value restore targets
- `@continuum-dev/runtime/view-evolution`
  - diagnostics for AI-authored or automated view edits

## Internal Docs

If you are maintaining or extending the runtime, these docs go deeper into the implementation:

- [Runtime boundaries](./src/lib/runtime-boundaries/README.md)
- [Restore candidates](./src/lib/restore-candidates/README.md)
- [View evolution](./src/lib/view-evolution/README.md)
- [Reconcile orchestration](./src/lib/reconcile/README.md)
- [Behavior guarantees](./src/lib/reconcile/behavior-guarantees.md)
- [Semantic key moves](./src/lib/reconcile/semantic-moves/README.md)
- [Context and matching](./src/lib/context/README.md)
- [Reconciliation internals](./src/lib/reconciliation/README.md)
- [Collection resolver](./src/lib/reconciliation/collection-resolver/README.md)
- [Node resolver](./src/lib/reconciliation/node-resolver/README.md)
- [Result builder](./src/lib/reconciliation/result-builder/README.md)
- [Differ](./src/lib/reconciliation/differ/README.md)
- [Migrator](./src/lib/reconciliation/migrator/README.md)
- [View traversal](./src/lib/reconciliation/view-traversal/README.md)
- [Validator](./src/lib/validator/README.md)

## Related Packages

- `@continuum-dev/contract` defines the view and snapshot model the runtime works with.
- `@continuum-dev/session` adds session orchestration around runtime behavior.
- `@continuum-dev/react` and `@continuum-dev/angular` bind the runtime model to UI frameworks.

## Dictionary Contract

### Core Terms

- `view`
  - the current UI structure you render
- `data`
  - the canonical runtime snapshot for that view
- `priorView`
  - the previous rendered view
- `priorData`
  - the previous canonical snapshot
- `lineage`
  - snapshot-level metadata such as `timestamp`, `sessionId`, `viewId`, and `viewVersion`
- `valueLineage`
  - per-node update metadata such as `lastUpdated`
- `detachedValues`
  - values the runtime preserved but could not safely attach to a current node
- `diffs`
  - change records describing what changed between states
- `resolutions`
  - per-node records explaining how the runtime handled each node
- `issues`
  - warnings, errors, or info emitted during processing

### Canonical Snapshot Fields

```ts
type DataSnapshot = {
  values: Record<string, NodeValue>;
  lineage: {
    timestamp: number;
    sessionId: string;
    viewId?: string;
    viewVersion?: string;
    viewHash?: string;
    lastInteractionId?: string;
  };
  valueLineage?: Record<string, ValueLineage>;
  detachedValues?: Record<string, DetachedValue>;
};
```

### `ReconciliationResolution.resolution`

These are the exact values you can see in `result.resolutions[*].resolution`:

```ts
'added' | 'carried' | 'migrated' | 'detached' | 'restored'
```

- `added`
  - the node is new and started fresh
- `carried`
  - the prior value was safely carried forward
- `migrated`
  - the value changed through migration or deterministic reshape behavior
- `detached`
  - the runtime refused unsafe carry and preserved the old value separately
- `restored`
  - a detached value was reattached to a compatible node

### `StateDiff.type`

These are the exact values you can see in `result.diffs[*].type`:

```ts
'added' | 'removed' | 'migrated' | 'type-changed' | 'restored'
```

### `ReconciliationIssue.severity`

These are the exact values you can see in `result.issues[*].severity`:

```ts
'error' | 'warning' | 'info'
```

### `ReconciliationResolution.matchedBy`

These are the exact values you can see in `result.resolutions[*].matchedBy`:

```ts
'id' | 'semanticKey' | 'key' | null
```

### `AppliedContinuumViewState.strategy`

These are the exact values returned by `applyContinuumViewUpdate(...)`:

```ts
'full' | 'incremental'
```

- `full`
  - normal reconcile-driven structural update
- `incremental`
  - presentation-content fast path

### `ContinuumNodeValueWriteDecision.kind`

These are the exact values returned by `decideContinuumNodeValueWrite(...)`:

```ts
'apply' | 'proposal' | 'unknown-node'
```

### `ApplyContinuumNodeValueWriteResult.kind`

These are the exact values returned by `applyContinuumNodeValueWrite(...)`:

```ts
'applied' | 'unknown-node'
```

### `ApplyContinuumViewStreamPartResult.incrementalHint`

Current runtime value:

```ts
'presentation-content'
```

This is returned only for append-only presentation updates that can use the incremental structural fast path.

### Issue Codes

These are the stable issue code values exported by the runtime:

```ts
'NO_PRIOR_DATA'
| 'NO_PRIOR_VIEW'
| 'TYPE_MISMATCH'
| 'NODE_REMOVED'
| 'MIGRATION_FAILED'
| 'UNVALIDATED_CARRY'
| 'VALIDATION_FAILED'
| 'UNKNOWN_NODE'
| 'DUPLICATE_NODE_ID'
| 'DUPLICATE_NODE_KEY'
| 'VIEW_CHILD_CYCLE_DETECTED'
| 'VIEW_MAX_DEPTH_EXCEEDED'
| 'COLLECTION_CONSTRAINT_VIOLATED'
| 'SCOPE_COLLISION'
| 'SEMANTIC_KEY_MISSING_STATEFUL'
| 'SEMANTIC_KEY_CHURN'
| 'VIEW_REPLACEMENT_RATIO_HIGH'
| 'DETACHED_FIELD_GROWTH'
| 'CONTINUITY_LOSS'
| 'ORPHANED_ACTION_INTENT'
| 'LAYOUT_DEPTH_EXPLOSION'
| 'COLLECTION_TEMPLATE_INVALID'
```

## License

MIT
