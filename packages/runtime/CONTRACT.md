# Runtime contract

## Update classes

- **Structural view update**: The view tree changes. Handled by `reconcile` (often via `applyContinuumViewUpdate`, which applies structural intent then reconciles). Invariants: prior view and prior data are inputs; output is a new canonical `DataSnapshot` with diffs, resolutions, and issues.

- **User value update**: The user edits a field while the view structure is unchanged. Handled by `applyContinuumNodeValueWrite` (and session-level write rules). Invariants: semantic values live under `DataSnapshot.values`; only canonical value state and lineage mutate; user protection is expressed through `isDirty` and `isSticky`.

- **External or AI value write**: Non-user sources use `decideContinuumNodeValueWrite` and related session paths so protected user data is not silently replaced. A value is protected when the current `NodeValue` is dirty or sticky. `suggestion` is staging metadata, not the protection predicate.

- **Focus (UI only)**: Which node is focused is not part of the canonical continuity snapshot. Session exposes `getFocusedNodeId` / `setFocusedNodeId` and `onFocusChange` so React can subscribe without persisting layout state in `DataSnapshot`. Focus is revalidated against the active render tree after pushed and streamed view changes and clears when the target node can no longer be resolved.

- **Helpers**: Node lookup, streamed structural parts, canonical snapshot sanitation, restore-candidate search, and validation live on explicit package subpaths (`node-lookup`, `view-stream`, `canonical-snapshot`, `restore-candidates`, `validator`). They are not alternate ways to mutate canonical data without going through the classes above.

## Canonical snapshot invariants

- `DataSnapshot` holds user-meaningful data: `values`, lineage, optional `valueLineage`, optional `detachedValues`.
- Ephemeral layout state (scroll, zoom, expansion) is not stored in `DataSnapshot`.
- Legacy viewport fields do not survive canonical runtime/session data paths.
- Structural changes always reconcile against the previous view and previous snapshot (or bootstrap branches when prior data or prior view is absent).

## Package boundary

**Root (`@continuum-dev/runtime`)** — stable contract: `reconcile`, `applyContinuumViewUpdate`, `applyContinuumNodeValueWrite`, `decideContinuumNodeValueWrite`, their boundary input/output types, shared protocol constants, and core reconciliation types such as `ReconciliationOptions`, `ReconcileInput`, `ReconciliationIssue`, `ReconciliationResolution`, and `StateDiff`.

**Subpaths** — optional capabilities: `@continuum-dev/runtime/validator`, `@continuum-dev/runtime/node-lookup`, `@continuum-dev/runtime/canonical-snapshot`, `@continuum-dev/runtime/value-write`, `@continuum-dev/runtime/view-stream`, `@continuum-dev/runtime/restore-candidates`.

The `view-stream` subpath exposes `applyContinuumViewStreamPart` for streamed structural parts. It supports progressive structure edits such as patch-like operations and `append-content`, and it returns the next view plus `affectedNodeIds` and an optional `incrementalHint` when the change is presentation-content only. Raw `ContinuumViewPatch` application helpers remain internal to the runtime package.

The `node-lookup` subpath exposes `collectCanonicalNodeIds`, `resolveNodeLookupEntry`, and `RuntimeNodeLookupEntry`. `resolveNodeLookupEntry` accepts a canonical id and also accepts a bare `node.id` when that id uniquely identifies exactly one node; it returns `null` when the node is missing or the bare id is ambiguous.

**Not public** — low-level patch application helpers (`applyContinuumViewPatch`, `patchViewNode`, and the `patchViewDefinition` name on package entrypoints) under `lib/view-patch`. Internal folders under `reconcile/`, `reconciliation/`, and `context/` are not a stable public API.

**`@continuum-dev/core`** — convenience aggregate that re-exports contract, runtime, and session; it does not redefine what belongs on the runtime root. Prefer `@continuum-dev/runtime` and its subpaths when you only need the runtime.
