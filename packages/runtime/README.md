# @continuum-dev/runtime

**A deterministic reconciliation engine for AI-generated interfaces.**

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

[![npm version](https://badge.fury.io/js/@continuum-dev%2Fruntime.svg)](https://badge.fury.io/js/@continuum-dev%2Fruntime)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Ephemerality Gap

The **Ephemerality Gap** is the mismatch between ephemeral, regenerating interfaces and durable user intent.

In a traditional app, UI structure is mostly stable. A field keeps the same identity, state lives in a predictable place, and preserving user input is straightforward.

In generative UI, the model can change the structure itself:

- a field gets renamed
- a field moves under a new container
- a top-level node becomes part of a collection template
- a schema changes shape between pushes

The user is still expressing the same intent, but the interface that used to hold that intent has changed underneath them.

That is the Ephemerality Gap. `@continuum-dev/runtime` exists to close it.

## What This Package Does

`@continuum-dev/runtime` accepts:

- a `newView`
- a `priorView`
- a `priorData` snapshot
- runtime `options`

It returns the next canonical snapshot plus an explanation of what happened during reconciliation.

Instead of guessing, the runtime applies deterministic rules for:

- carrying values forward when identity is still defensible
- migrating values when schema changes are explicitly supported
- detaching values when carry would be unsafe
- restoring detached values when compatible structure returns
- surfacing issues when the new view introduces ambiguity or invalid state

This package is pure TypeScript, framework-agnostic, and side-effect free inside reconciliation.

```bash
npm install @continuum-dev/runtime
```

## Upgrade Note (0.3.x to Next)

- Reconcile call form is object-shaped: `reconcile({ newView, priorView, priorData, options })`.
- Migration strategy callbacks now prefer a context object argument.
- Legacy positional migration callbacks remain supported for backward compatibility.

Upgrade references:

- Upgrade and API delta notes (private maintainer documentation repository)

## Why Reconciliation Matters

Suppose a user typed an email into a field keyed as `user_email`. On the next model push, that field is moved under a new layout group and gets a different node ID.

Without reconciliation, the old node disappears, the new node mounts, and the user's input is lost.

With Continuum runtime, the value can survive because the engine reconciles the **meaning** of the field across structural change, not just its old raw ID.

## Quick Start

The API is object-shaped:

```typescript
import { reconcile } from '@continuum-dev/runtime';

const priorView = {
  viewId: 'v1',
  version: '1.0',
  nodes: [{ id: 'random_id_1', key: 'user_email', type: 'field' }],
};

const priorData = {
  values: {
    random_id_1: { value: 'alice@example.com' },
  },
  lineage: {
    timestamp: 100,
    sessionId: 'session_123',
    viewId: 'v1',
    viewVersion: '1.0',
  },
};

const newView = {
  viewId: 'v2',
  version: '2.0',
  nodes: [
    {
      id: 'layout_group',
      type: 'group',
      children: [{ id: 'new_id_99', key: 'user_email', type: 'field' }],
    },
  ],
};

const result = reconcile({
  newView,
  priorView,
  priorData,
  options: {},
});

console.log(result.reconciledState.values['layout_group/new_id_99']);
console.log(result.diffs);
console.log(result.resolutions);
console.log(result.issues);
```

## What `reconcile()` Returns

Every run returns a `ReconciliationResult`:

```typescript
interface ReconciliationResult {
  reconciledState: DataSnapshot;
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  resolutions: ReconciliationResolution[];
}
```

- `reconciledState` is the snapshot you persist and render next.
- `diffs` records what changed.
- `resolutions` explains how each node in the new view was resolved.
- `issues` reports ambiguity, safety boundaries, and validation problems.

For integrations, that inspectability matters almost as much as the carry logic itself.

## How Matching Works

In a full transition, Continuum does not use fuzzy heuristics. It uses fixed precedence:

1. scoped `id`
2. unique `semanticKey`
3. scoped `key`

Important details:

- Matching is path-aware, not just raw local ID matching.
- Semantic-key matching is only used when the semantic key is unique on both sides.
- `semanticKey` is the reshape-safe continuity contract for stateful nodes.
- `key` remains a scoped data-binding signal, not a substitute for `semanticKey` during structural moves.
- If carry would be unsafe, the runtime keeps the value in `detachedValues` instead of forcing it into the wrong node.
- If a compatible node reappears later, that detached value can be restored.

This is how the runtime preserves continuity without pretending uncertain matches are safe.

## The Three Runtime Branches

`reconcile()` always takes exactly one branch.

### 1. Initial snapshot (no prior data)

Used when `priorData === null`.

- Initializes state from the new view.
- Emits added outcomes for the new nodes.
- Requires `options.clock`, because there is no prior lineage timestamp to advance.

### 2. Prior data without prior view

Used when `priorData !== null` and `priorView === null`.

- Emits `NO_PRIOR_VIEW`.
- Can copy prior values only by exact scoped node ids when `allowPriorDataWithoutPriorView` is enabled.
- Does not attempt key or semantic-key matching in this mode.

### 3. Full Transition

Used when both `priorView` and `priorData` exist.

- Builds deterministic context and lookup state.
- Resolves each new node as added, carried, migrated, detached, restored, or collection-reconciled.
- Detects removed nodes and preserves their values as detached state.
- Applies same-push restore and semantic-key move transforms.
- Assembles the final snapshot and issues.

## Key Guarantees

The runtime is designed around explicit, inspectable guarantees:

- Same inputs produce the same outputs for a fixed timestamp source.
- Type-incompatible transitions do not blindly carry old values into new nodes.
- Migration failures do not crash reconciliation; they surface as issues and fall back deterministically.
- Detached values are preserved instead of silently discarded.
- Compatible reappearance can restore detached state.
- Collection normalization and constraint handling are deterministic.
- Validation issues are emitted as structured runtime issues.

## Migration Strategies

When a node hash changes and you want a deliberate data transformation, provide migration strategies through `ReconciliationOptions`.

```typescript
import { reconcile } from '@continuum-dev/runtime';

const result = reconcile({
  newView,
  priorView,
  priorData,
  options: {
    migrationStrategies: {
      status: ({ priorValue }) => {
        const typedValue = priorValue as { value: string };
        return { value: typedValue.value.toUpperCase() };
      },
    },
    strategyRegistry: {
      stringToArray: ({ priorValue }) => {
        const typedValue = priorValue as { value: string };
        return { value: [typedValue.value] };
      },
    },
  },
});
```

The exported `MigrationStrategy` type is context-shaped: `({ nodeId, priorNode, newNode, priorValue }) => unknown`.

## Public API Surface

### Root import (contract boundary)

```typescript
import {
  reconcile,
  applyContinuumViewUpdate,
  applyContinuumNodeValueWrite,
  decideContinuumNodeValueWrite,
} from '@continuum-dev/runtime';
```

The root entry exposes `reconcile`, the structural and value-write entrypoints above, shared protocol constants (`ISSUE_CODES`, `VIEW_DIFFS`, and related), and runtime types from `src/lib/types.ts`. Low-level view patch mechanics are internal to the package; structural changes should go through `applyContinuumViewUpdate` or streamed parts via `applyContinuumViewStreamPart` on the `view-stream` subpath.

Root type exports include the reconcile contract (`ReconciliationOptions`, `ReconcileInput`, `ReconciliationIssue`, `ReconciliationResolution`, `StateDiff`) plus the boundary input and result types for `applyContinuumViewUpdate`, `applyContinuumNodeValueWrite`, and `decideContinuumNodeValueWrite`.

### Explicit subpaths

```typescript
import { validateNodeValue } from '@continuum-dev/runtime/validator';
import {
  collectCanonicalNodeIds,
  resolveNodeLookupEntry,
} from '@continuum-dev/runtime/node-lookup';
import { sanitizeContinuumDataSnapshot } from '@continuum-dev/runtime/canonical-snapshot';
import {
  applyContinuumNodeValueWrite,
  decideContinuumNodeValueWrite,
} from '@continuum-dev/runtime/value-write';
import { applyContinuumViewStreamPart } from '@continuum-dev/runtime/view-stream';
import { findRestoreCandidates } from '@continuum-dev/runtime/restore-candidates';
```

`resolveNodeLookupEntry` accepts canonical ids and also accepts a bare `node.id` when that id uniquely identifies one node. It returns `null` when the node cannot be resolved or when the bare id is ambiguous.

`applyContinuumViewStreamPart` is the public streamed-structure helper. It applies progressive structural parts, including `append-content`, and returns `{ view, affectedNodeIds, incrementalHint? }`.

### Reconcile Signature

```typescript
function reconcile(input: ReconcileInput): ReconciliationResult;
```

### Important Types

`ReconciliationOptions`

```typescript
interface ReconciliationOptions {
  allowPartialRestore?: boolean;
  allowPriorDataWithoutPriorView?: boolean;
  migrationStrategies?: Record<string, MigrationStrategy>;
  strategyRegistry?: Record<string, MigrationStrategy>;
  clock?: () => number;
}
```

`ReconciliationResolution`

```typescript
interface ReconciliationResolution {
  nodeId: string;
  priorId: string | null;
  matchedBy: 'id' | 'semanticKey' | 'key' | null;
  priorType: string | null;
  newType: string;
  resolution: DataResolution;
  priorValue: unknown;
  reconciledValue: unknown;
}
```

## Internal Docs

The package README describes the supported contract.

These deeper documents explain implementation details and maintenance-level behavior:

- Runtime comprehensive reference (private maintainer documentation repository)
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

Those docs are for understanding how the runtime works internally. They are not a promise that every internal module is a stable public integration surface.

## Ecosystem

This package is the core reconciliation engine in the Continuum stack.

- `@continuum-dev/session` adds stateful session management around streamed UI pushes.
- `@continuum-dev/react` provides React bindings and rendering utilities.
- `@continuum-dev/angular` provides Angular bindings and directives.

## License

MIT © Bryton Cooper
