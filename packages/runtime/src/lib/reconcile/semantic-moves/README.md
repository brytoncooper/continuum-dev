# Semantic Key Moves

This module applies post-resolution value moves between top-level nodes and collection-template nodes when semantic identity survives but location changes across levels.

It is an internal reconcile stage, not a public package boundary.

## When This Runs

`applySemanticKeyMoves` runs only in the full transition path, after:

1. per-node resolution,
2. removed-node detection,
3. same-push detach-to-restore rewriting.

It does not run for fresh snapshots or prior-data-without-prior-view reconciliation.

## What It Looks At

The stage collects semantic-key locations from both prior and next view trees.

Each location is tagged as:

- `level: "top"`
- `level: "collection"`

Collection locations also carry:

- `outerCollectionId`
- `pathChain`

The planner only considers moves across levels:

- top -> collection
- collection -> top

It does not handle top -> top or collection -> collection migration.

## Planning Rules

Two planners produce move intents:

- `planTopToCollectionMoves(priorLocations, newLocations)`
- `planCollectionToTopMoves(priorLocations, newLocations)`

An intent is created only when:

- the source no longer has a unique same-type semantic match on its original level,
- the destination has a unique same-type semantic match on the destination level,
- collection moves have a valid `outerCollectionId`,
- collection moves have a non-empty `pathChain`.

## Apply Behavior

### Top To Collection

`applyTopToCollectionMoves`:

1. reads the source value from `priorData.values[source.nodeId]`,
2. writes that value through the target collection path chain in `resolved.values[outerCollectionId]`,
3. deletes the old top-level value from `resolved.values`,
4. emits at most one `migrated` diff per affected outer collection.

### Collection To Top

`applyCollectionToTopMoves`:

1. reads the source value from the first item of the source collection path chain,
2. clones that value into `resolved.values[target.nodeId]`,
3. emits at most one `migrated` diff per affected top-level target node.

Collection-to-top extraction intentionally uses the first item as the deterministic selection rule.

## Important Limits

This stage mutates:

- `resolved.values`
- `resolved.diffs`

It does not create new resolution records and it does not update `valueLineage`.

That means these moves are a targeted post-pass for preserving data shape, not a second full reconciliation cycle.

## Collection Lens Responsibilities

The collection-lens helpers provide the read and write mechanics used here:

- `updateCollectionTargetValue`
- `readCollectionFirstItemValue`
- `writePathChain`
- `readPathFromFirstItem`
- `normalizeCollectionState`

## Test Anchors

Primary behavior coverage lives in:

- `packages/runtime/src/lib/reconcile/semantic-key.spec.ts`
- `packages/runtime/src/lib/reconcile/semantic-moves/semantic-key-move-planner.spec.ts`
- `packages/runtime/src/lib/reconcile/collection-lens/collection-path-lens.spec.ts`

