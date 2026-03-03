# Reconciliation Internals

These modules are internal to `@continuum/runtime`. They are imported only by the top-level `reconcile.ts` orchestrator and are not re-exported through the package's public API.

## Data Flow

```
reconcile.ts (orchestrator)
  ├─ state-builder.buildFreshSessionResult     when no prior state
  ├─ state-builder.buildBlindCarryResult       when no prior view
  └─ full reconciliation path:
       context.buildReconciliationContext  →  index nodes by id and key
       context.buildPriorValueLookupByIdAndKey  →  map prior values to new IDs via key matching
       node-resolver.resolveAllNodes  →  per-node decisions
         ├─ differ.*  →  create diff and resolution entries
         └─ migrator.attemptMigration  →  resolve migration strategies
       node-resolver.detectRemovedNodes  →  find orphaned state
       state-builder.assembleReconciliationResult  →  pack final output
```

## Modules

| File               | Responsibility                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `differ.ts`        | Pure factory functions that build `StateDiff` and `ReconciliationResolution` objects. No logic, just construction.                                  |
| `migrator.ts`      | Resolves which migration strategy to use (explicit, view-declared, or same-type passthrough) and applies it.                                        |
| `node-resolver.ts` | Iterates every node in the new view and decides its fate: added, type-changed (dropped), migrated, or carried. Also detects removed nodes.          |
| `state-builder.ts` | Builds the final `ReconciliationResult` for all three code paths. Owns utility functions for session IDs, view hashing, and value meta propagation. |
