# Runtime Boundaries

This folder contains the public runtime helper boundaries that sit around core reconciliation.

These helpers are how package consumers perform canonical structural updates, direct value writes, node lookup, and streamed structural application without importing internal reconciliation modules.

## Package Mapping

Root exports:

- `applyContinuumViewUpdate`
- `applyContinuumNodeValueWrite`
- `decideContinuumNodeValueWrite`

Explicit subpaths:

- `@continuum-dev/runtime/canonical-snapshot`
  - `sanitizeContinuumDataSnapshot`
- `@continuum-dev/runtime/node-lookup`
  - `collectCanonicalNodeIds`
  - `resolveNodeLookupEntry`
- `@continuum-dev/runtime/value-write`
  - `applyContinuumNodeValueWrite`
  - `decideContinuumNodeValueWrite`
- `@continuum-dev/runtime/view-stream`
  - `applyContinuumViewStreamPart`

`transform-plans.ts` is used internally by `applyContinuumViewUpdate`; it is not a published package subpath.

## `applyContinuumViewUpdate`

`applyContinuumViewUpdate(input)` is the structural boundary for runtime-safe view changes.

Execution order:

1. validate the next view shape,
2. patch `baseView` into `nextView`,
3. sanitize `baseData` into the canonical snapshot shape,
4. try the presentation-only incremental fast path,
5. otherwise re-enter `reconcile(...)`,
6. optionally apply a transform plan,
7. return canonical `{ priorView, view, data, issues, diffs, resolutions, strategy }`.

Important behavior:

- legacy snapshot fields such as `viewContext` are removed,
- suggestion payloads are stripped before structural reconciliation,
- populated values are preserved conservatively during structural updates,
- `strategy` is `'incremental'` only for the presentation-content fast path,
- incremental presentation updates are expected to stay equivalent to a full reconcile result.

## `decideContinuumNodeValueWrite`

`decideContinuumNodeValueWrite(input)` answers whether a non-user write should apply directly or become a proposal.

Return kinds:

- `unknown-node`
  - view is missing or the node cannot be resolved
- `proposal`
  - the current canonical value is protected by `isDirty` or `isSticky`
- `apply`
  - the write can apply immediately

Suggestion-only values are not treated as protected proposal state.

## `applyContinuumNodeValueWrite`

`applyContinuumNodeValueWrite(input)` writes one canonical node value into runtime snapshot data.

Important behavior:

- resolves the requested node id to a canonical id first,
- creates a fresh canonical snapshot when `data` is null,
- updates `lineage.timestamp`, `lineage.viewId`, `lineage.viewVersion`, and optional `lastInteractionId`,
- updates `valueLineage[lastCanonicalId].lastUpdated`,
- optionally validates the written value when `validate === true`,
- never preserves legacy non-canonical snapshot fields on output.

## Node Lookup

`resolveNodeLookupEntry(nodes, requestedId)` accepts:

- a canonical id directly, or
- a bare `node.id` when that raw id is unique in the current tree.

It returns `null` when the id is missing or when the bare id is ambiguous.

`collectCanonicalNodeIds(nodes)` returns every canonical id reachable from the current tree.

## Streamed View Parts

`applyContinuumViewStreamPart(input)` applies one streamed structural part to a `currentView`.

Supported parts:

- `patch`
- `insert-node`
- `move-node`
- `wrap-nodes`
- `replace-node`
- `remove-node`
- `append-content`

`append-content` is special:

- it targets a presentation node,
- it can resolve by `nodeId` or unique `semanticKey`,
- it returns `incrementalHint: 'presentation-content'`,
- callers can pass its result into `applyContinuumViewUpdate` for the incremental structural fast path.

## Canonical Snapshot Sanitization

`sanitizeContinuumDataSnapshot(data)` returns only supported runtime fields:

- `values`
- `lineage`
- optional `valueLineage`
- optional `detachedValues`

This helper is the canonical boundary for removing legacy snapshot extras before runtime logic proceeds.
