# Reconciliation Internals

Website: [continuumstack.dev](https://continuumstack.dev)  
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

## Purpose

`reconciliation` contains internal primitives used by the reconcile orchestrator. These modules are implementation details of `@continuum-dev/runtime`.

Public execution starts at:

- `packages/runtime/src/lib/reconcile/index.ts`
- `packages/runtime/src/lib/reconcile/reconcile-core.ts`

## Internal Data Flow

```text
reconcile/reconcile-core.ts
  ├─ buildFreshSessionResult          when priorData is null
  ├─ buildBlindCarryResult            when priorData exists and priorView is null
  └─ reconcileViewTransition          full transition path
       ├─ context.buildReconciliationContext
       ├─ context.buildPriorValueLookupByIdAndKey
       ├─ node-resolver.resolveAllNodes
       ├─ node-resolver.detectRemovedNodes
       ├─ reconcile.restoreFromSamePushDetachments
       ├─ reconcile.applySemanticKeyMoves
       └─ result-builder.assembleReconciliationResult
```

## Submodule Responsibilities

| Area | Responsibility |
| --- | --- |
| `node-resolver/*` | Per-node resolution, type mismatch handling, migration application, unchanged carry, and removal detection. |
| `result-builder/*` | Final `ReconciliationResult` assembly, lineage updates, view hash/session helpers, fresh/blind branch result creation. |
| `differ/*` | Factories for `StateDiff` and `ReconciliationResolution` records. |
| `collection-resolver/*` | Collection initialization, template path remapping, and collection-state reconciliation helpers. |
| `view-traversal.ts` | Deterministic traversal with cycle and max-depth issue reporting. |

## Canonical Docs

For current engine behavior and diagrams, see:

- `packages/runtime/src/lib/reconcile/README.md`
- `packages/runtime/src/lib/reconcile/semantic-moves/README.md`
- `packages/runtime/src/lib/reconcile/behavior-guarantees.md`
