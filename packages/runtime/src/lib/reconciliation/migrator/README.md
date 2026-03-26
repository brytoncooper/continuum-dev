# Migrator Architecture

The migrator resolves node-value transitions when a matched node changes hash across view versions.

It is an internal runtime module used by node and collection reconciliation.

## Public Entrypoint

- `reconciliation/migrator/index.ts`

Internal implementation:

- `reconciliation/migrator/migrator-core.ts`

## Import Boundary

- callers inside runtime should import from `../migrator/index.js`
- internal files under `migrator/` are private implementation details

## API Surface

- `attemptMigration(...)`
  - preferred call: `attemptMigration({ nodeId, priorNode, newNode, priorValue, options })`
  - legacy call: `attemptMigration(nodeId, priorNode, newNode, priorValue, options)`
- `MigrationAttemptResult`
  - `{ kind: 'migrated'; value: unknown }`
  - `{ kind: 'none' }`
  - `{ kind: 'error'; error: unknown }`

## Resolution Precedence

Migration selection is deterministic and ordered:

1. explicit per-node strategy from `options.migrationStrategies[nodeId]`
2. first matching direct rule in `newNode.migrations`
3. shortest registered BFS chain through `newNode.migrations`
4. `none`

Direct and chained rule execution require:

- `priorNode.hash`
- `newNode.hash`
- `newNode.migrations`
- `options.strategyRegistry`

If those prerequisites are missing, the migrator returns `{ kind: 'none' }`.

## Strategy Signatures

The exported `MigrationStrategy` type is context-shaped:

```ts
type MigrationStrategy = (context: {
  nodeId: string;
  priorNode: ViewNode;
  newNode: ViewNode;
  priorValue: unknown;
}) => unknown;
```

For backward compatibility, the runtime still detects and invokes older positional strategies when possible.

## Chain Determinism Guarantees

- BFS traversal preserves declaration order from `newNode.migrations`
- equal-length path ties resolve by declaration order
- cycle handling is stable through `seen` tracking
- maximum chain depth is `10`
- each chain step receives the previous step output as `priorValue`

## Failure Semantics

- missing explicit strategy or reachable rule path -> `{ kind: 'none' }`
- thrown strategy error -> `{ kind: 'error', error }`
- successful execution -> `{ kind: 'migrated', value }`

The migrator never throws strategy failures back to callers directly.

## Callers

Primary callers:

- `node-resolver/resolve-hash-changed-node.ts`
- `collection-resolver/reconcile-collection-value.ts`

Those callers decide how migration failures surface in runtime issues and fallback behavior.
