# Reconciliation Internals

These modules are internal to `@continuum/runtime`. They are imported only by the top-level `reconcile.ts` orchestrator and are not re-exported through the package's public API.

## Data Flow

```
reconcile.ts (orchestrator)
  ├─ state-builder.buildFreshSessionResult     when no prior state
  ├─ state-builder.buildBlindCarryResult       when no prior schema
  └─ full reconciliation path:
       context.buildReconciliationContext  →  index components by id and key
       context.buildPriorValueMap          →  map prior values to new IDs via key matching
       component-resolver.resolveAllComponents  →  per-component decisions
         ├─ differ.*  →  create diff and trace entries
         └─ migrator.attemptMigration  →  resolve migration strategies
       component-resolver.detectRemovedComponents  →  find orphaned state
       state-builder.assembleReconciliationResult  →  pack final output
```

## Modules

| File | Responsibility |
|---|---|
| `differ.ts` | Pure factory functions that build `StateDiff` and `ReconciliationTrace` objects. No logic, just construction. |
| `migrator.ts` | Resolves which migration strategy to use (explicit, schema-declared, or same-type passthrough) and applies it. |
| `component-resolver.ts` | Iterates every component in the new schema and decides its fate: added, type-changed (dropped), migrated, or carried. Also detects removed components. |
| `state-builder.ts` | Builds the final `ReconciliationResult` for all three code paths. Owns utility functions for session IDs, schema hashing, and value meta propagation. |
