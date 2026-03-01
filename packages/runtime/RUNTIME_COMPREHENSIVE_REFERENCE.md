# `@continuum/runtime` Comprehensive Reference

This document is a deep technical guide to everything currently inside `packages/runtime`.

It is written for both:
- humans onboarding to the runtime package, and
- AI agents that need precise, implementation-level context.

---

## 1) Package Purpose

`@continuum/runtime` is a pure reconciliation engine:
- Input: `newView`, `priorView`, `priorData`, and optional reconciliation options.
- Output: a deterministic `ReconciliationResult` containing:
  - `reconciledData`
  - `diffs`
  - `issues`
  - `resolutions`

Core guarantee: no I/O side effects in reconciliation itself. Given the same inputs and same clock function, output is reproducible.

---

## 2) Full File Inventory (Current)

### Package and Tooling Files

1. `package.json`
2. `project.json`
3. `tsconfig.json`
4. `tsconfig.lib.json`
5. `vitest.config.ts`
6. `README.md`
7. `RUNTIME_COMPREHENSIVE_REFERENCE.md` (this document)

### Public Entry and Library Source

8. `src/index.ts`
9. `src/lib/types.ts`
10. `src/lib/context.ts`
11. `src/lib/reconcile.ts`
12. `src/lib/reconciliation/README.md`
13. `src/lib/reconciliation/differ.ts`
14. `src/lib/reconciliation/migrator.ts`
15. `src/lib/reconciliation/node-resolver.ts`
16. `src/lib/reconciliation/state-builder.ts`
17. `src/lib/reconciliation/validator.ts`

### Tests

18. `src/lib/context.spec.ts`
19. `src/lib/reconcile.spec.ts`
20. `src/lib/reconcile-hardening.spec.ts`
21. `src/lib/reconciliation/differ.spec.ts`
22. `src/lib/reconciliation/migrator.spec.ts`
23. `src/lib/reconciliation/node-resolver.spec.ts`
24. `src/lib/reconciliation/state-builder.spec.ts`

---

## 3) High-Level Architecture

Top-level flow:

1. `reconcile()` in `src/lib/reconcile.ts` is the orchestrator.
2. It branches into one of three paths:
   - fresh session (no prior data),
   - blind carry (prior data exists but no prior view),
   - full view transition reconciliation.
3. Full reconciliation path uses:
   - `context.ts` for indexing and matching,
   - `node-resolver.ts` for per-node decisions,
   - `migrator.ts` for migration strategy resolution,
   - `differ.ts` for normalized diff/resolution records,
   - `validator.ts` for constraint checks,
   - `state-builder.ts` for final data assembly.

---

## 4) Public API Surface

From `src/index.ts`, the package exports:
- everything in `src/lib/reconcile.ts`
- everything in `src/lib/types.ts`
- everything in `src/lib/context.ts`
- everything in `src/lib/reconciliation/validator.ts`

Notably, the internal reconciliation modules (`differ`, `migrator`, `node-resolver`, `state-builder`) are not exported from `src/index.ts`.

---

## 5) File-by-File Deep Reference

## `package.json`

Purpose:
- package metadata and entry wiring.

Important fields:
- `name: "@continuum/runtime"`
- `type: "module"` (ESM semantics)
- `main` and `types` both point to `./src/index.ts` in-repo
- dependency on `@continuum/contract`

Methods/functions:
- none

---

## `project.json`

Purpose:
- Nx project registration.

Important fields:
- `name: "runtime"`
- `sourceRoot: "packages/runtime/src"`
- `projectType: "library"`
- tag `scope:shared`

Methods/functions:
- none

---

## `tsconfig.json`

Purpose:
- local TypeScript project config entry extending `tsconfig.lib.json`.

Methods/functions:
- none

---

## `tsconfig.lib.json`

Purpose:
- compile-time settings for library builds.

Notable behavior:
- compiles `src/**/*.ts`
- excludes spec/test files
- references `../contract/tsconfig.lib.json`

Methods/functions:
- none

---

## `vitest.config.ts`

Purpose:
- test runner configuration.

Function inventory:
- `defineConfig(() => ({ ... }))`
  - sets package-local Vite cache dir
  - configures Vitest name, environment (`node`), include globs, reporters, and coverage output

---

## `README.md`

Purpose:
- user-facing package overview and API quickstart.

Methods/functions:
- none (documentation only)

---

## `src/index.ts`

Purpose:
- public export barrel.

Function inventory:
- none (exports only)

---

## `src/lib/types.ts`

Purpose:
- typed contracts for reconcile outputs, options, and internal accumulators.

Defined types/interfaces:
- `ReconciliationResult`
- `StateDiff`
- `ReconciliationResolution`
- `ReconciliationIssue`
- `ReconciliationOptions`
- `MigrationStrategy` (function type)
- `NodeResolutionAccumulator` (internal shape used by resolver pipeline)

Methods/functions:
- none

---

## `src/lib/context.ts`

Purpose:
- build view indexing maps and match helpers used by reconciliation.

### `buildReconciliationContext(newView, priorView): ReconciliationContext`

Behavior:
- recursively indexes both views (new and prior) into:
  - `newById`, `newByKey`
  - `priorById`, `priorByKey`
- supports nested `children` traversal.

Internal helper:
- `indexNodesByIdAndKey(nodes, byId, byKey)`
  - walks node trees recursively.
  - last-write-wins semantics if duplicate IDs or keys exist.

### `findPriorNode(ctx, newNode): ViewNode | null`

Behavior:
- match order:
  1. `priorById` lookup by `newNode.id`
  2. if no id match and `newNode.key` exists: `priorByKey` lookup
  3. return `null` when unmatched

### `buildPriorValueLookupByIdAndKey(priorData, ctx): Map<string, unknown>`

Behavior:
- starts from prior data `values` object.
- maps direct prior IDs to values.
- also maps values forward to new node IDs when a prior node key maps to a new node key.

Why this matters:
- enables carrying data across ID changes where stable `key` is preserved.

### `determineNodeMatchStrategy(ctx, newNode, priorNode): 'id' | 'key' | null`

Behavior:
- returns:
  - `null` if `priorNode` is null
  - `'id'` if `ctx.priorById.has(newNode.id)`
  - `'key'` otherwise

Notes:
- assumes caller already provided a valid `priorNode` from match logic.

---

## `src/lib/reconcile.ts`

Purpose:
- public orchestration layer.

### `reconcile(newView, priorView, priorData, options?): ReconciliationResult`

Branching behavior:
- if no `priorData`: calls `buildFreshSessionResult`
- else if no `priorView`: calls `buildBlindCarryResult`
- else: calls `reconcileViewTransition`

Clock handling:
- timestamp source is `options.clock ?? Date.now`
- one timestamp per invocation, used throughout the selected path

### `reconcileViewTransition(newView, priorView, priorData, now, options)`

Behavior:
1. build context maps
2. build prior value lookup by ID+key
3. resolve all new-view nodes
4. detect removed prior nodes
5. assemble final result

Methods exported:
- only `reconcile`

---

## `src/lib/reconciliation/README.md`

Purpose:
- internal module map for the reconciliation subsystem.

Methods/functions:
- none

---

## `src/lib/reconciliation/differ.ts`

Purpose:
- pure constructors for normalized diff and resolution objects.

No branching orchestration, no state mutation outside return values.

### Diff builders

1. `addedDiff(nodeId)`
   - type: `added`
   - reason: node added to view

2. `removedDiff(nodeId, oldValue)`
   - type: `removed`
   - captures prior value

3. `typeChangedDiff(nodeId, oldValue, priorType, newType)`
   - type: `type-changed`
   - reason includes old/new type names

4. `migratedDiff(nodeId, oldValue, newValue)`
   - type: `migrated`
   - includes both values

5. `restoredDiff(nodeId, newValue)`
   - type: `restored`
   - used when detached value is restored to a reintroduced node

### Resolution builders

6. `addedResolution(nodeId, newType)`
7. `carriedResolution(nodeId, priorId, matchedBy, nodeType, priorValue, reconciledValue)`
8. `droppedResolution(nodeId, priorId, matchedBy, priorType, newType, priorValue)`
9. `migratedResolution(nodeId, priorId, matchedBy, priorType, newType, priorValue, reconciledValue)`
10. `restoredResolution(nodeId, priorType, reconciledValue)`

Resolution semantics:
- each function emits one well-formed data resolution aligned with `DATA_RESOLUTIONS`.

---

## `src/lib/reconciliation/migrator.ts`

Purpose:
- encapsulates migration strategy resolution and execution.

### `attemptMigration(nodeId, priorDefinition, newDefinition, priorValue, options): MigrationAttemptResult`

Result union:
- `{ kind: 'migrated', value }`
- `{ kind: 'none' }`
- `{ kind: 'error', error }`

Resolution priority:
1. explicit per-node override in `options.migrationStrategies[nodeId]`
2. view-declared migration rule (`newDefinition.migrations`) + `options.strategyRegistry`
3. fallback passthrough when types match (`value = priorValue`)
4. no migration (`kind: 'none'`) when types differ and no strategy exists

Error model:
- any thrown strategy error is caught and returned as `{ kind: 'error' }`

---

## `src/lib/reconciliation/node-resolver.ts`

Purpose:
- core per-node reconciliation engine and removal detection.

### `resolveAllNodes(ctx, priorValues, priorData, now, options): NodeResolutionAccumulator`

Behavior:
- iterates every node in `ctx.newById`.
- per node:
  1. find prior match
  2. compute `priorValue`
  3. determine match strategy
  4. route into one of:
     - new node path
     - type mismatch path
     - hash changed path
     - unchanged path
  5. run `validateNodeValue` on resolved value

Accumulator fields populated:
- `values`
- `valueLineage`
- `detachedValues`
- `restoredDetachedKeys`
- `diffs`
- `resolutions`
- `issues`

### `resolveNewNode(acc, newId, newNode, priorData, now)` (internal)

Behavior:
- if matching detached value exists by key/id and type matches:
  - restore detached value
  - emit `restored` diff/resolution
  - mark key in `restoredDetachedKeys`
- otherwise:
  - apply `defaultValue` if present
  - emit `added` diff/resolution

### `resolveTypeMismatchedNode(...)` (internal)

Behavior:
- emits `TYPE_MISMATCH` error issue
- emits `type-changed` diff
- emits `dropped` resolution
- saves prior value into `detachedValues` with reason `type-mismatch`

### `hasNodeHashChanged(priorNode, newNode)` (internal)

Behavior:
- returns true only when both hashes exist and differ.

### `resolveHashChangedNode(...)` (internal)

Behavior:
- calls `attemptMigration`
- on migrated:
  - write migrated value
  - carry valueLineage (mark migrated)
  - emit migrated diff/resolution
- on error/none:
  - emit `MIGRATION_FAILED` warning
  - fallback to unchanged carry path

### `resolveUnchangedNode(...)` (internal)

Behavior:
- carries prior value if present
- carries valueLineage unchanged
- emits `carried` resolution

### `detectRemovedNodes(ctx, priorData, options, now)`

Return shape:
- `{ diffs, issues, detachedValues }`

Behavior:
- scans prior data values and flags entries whose node no longer exists by ID or key in new view.
- for removed entries:
  - emits `removed` diff
  - records detached value with reason `node-removed`
  - emits `NODE_REMOVED` warning unless `allowPartialRestore` is enabled

---

## `src/lib/reconciliation/state-builder.ts`

Purpose:
- construct final `ReconciliationResult` objects and metadata propagation utilities.

### `buildFreshSessionResult(newView, now): ReconciliationResult`

Behavior:
- builds empty/seeded values from node defaults
- marks all nodes as added (including nested)
- creates new `sessionId`
- emits `NO_PRIOR_DATA` info issue

Internal helper:
- `collectNodesAsFreshlyAdded(nodes, values, diffs, resolutions)`
  - recursive traversal to initialize defaults and add entries for each node.

### `collectNodeIds(nodes)` (internal)

Behavior:
- recursively collects all node IDs in a view tree.
- used in blind carry mode.

### `buildBlindCarryResult(newView, priorData, now, options): ReconciliationResult`

Behavior:
- always emits `NO_PRIOR_VIEW` warning.
- if `allowBlindCarry` true:
  - carries values only for IDs that still exist in new view
  - emits `UNVALIDATED_CARRY` info issue per carried node
- if false:
  - drops all prior values

### `assembleReconciliationResult(resolved, removals, priorData, newView, now): ReconciliationResult`

Behavior:
- computes optional view hash
- merges:
  - resolved values
  - resolved + removal diffs/issues
  - carried and newly detached values
- deletes detached keys that were restored in the current pass
- includes `valueLineage` and `detachedValues` only when non-empty

### `carryValueLineage(target, newId, priorId, priorData, now, isMigrated): void`

Behavior:
- copies prior `valueLineage[priorId]` to `target[newId]` if it exists.
- when migrated, updates `lastUpdated` to `now`.

### `computeViewHash(view): string | undefined`

Behavior:
- recursively collects node hashes
- returns `undefined` if none found
- otherwise returns `JSON.stringify(hashes.sort())`

Property:
- order-independent due to sorting

### `generateSessionId(now): string`

Behavior:
- format: `session_${now}_${random}`
- randomness comes from `Math.random()`

---

## `src/lib/reconciliation/validator.ts`

Purpose:
- lightweight node-value validation against view constraints.

### `readNodeValue(state)` (internal)

Behavior:
- extracts candidate value from `NodeValue<T>`:
  - `value`
- returns `undefined` for non-object or unsupported shape.

### `isEmptyValue(value)` (internal)

Behavior:
- empty if:
  - `null`/`undefined`
  - blank string after trim
  - empty array

### `validateNodeValue(definition, state): ReconciliationIssue[]`

Behavior:
- no constraints -> empty array
- required validation -> warning on empty value
- numeric validations: `min` and `max`
- string validations: `minLength`, `maxLength`, `pattern`
- invalid regex pattern safely handled as warning

Issue code emitted:
- `VALIDATION_FAILED`

---

## 6) Test Suite: File-by-File Coverage Map

## `src/lib/context.spec.ts`

Helper methods:
- `makeView(nodes, id?, version?)`
- `makeNode(overrides)`

Coverage:
- flat ID indexing
- key indexing
- recursive child indexing
- null prior view handling
- matching preference (id before key)
- null when no match

---

## `src/lib/reconcile.spec.ts`

Helper methods:
- `makeView(...)`
- `makeNode(...)`
- `makeData(values, lineage?, valueLineage?)`

Coverage domains:
- fresh-data behavior (`NO_PRIOR_DATA`)
- blind carry/no-prior-view behavior
- nested blind carry
- matching by id and key
- added/removed/type-changed/migrated diffs
- type mismatch behavior and dropped values
- migration strategy priority (explicit > registry)
- migration error/non-applicability behavior
- valueLineage carry/drop/remap and migrated timestamp updates
- viewHash presence/absence/order determinism
- deterministic timestamp with injected clock
- resolution entry integrity for all data resolutions
- metadata propagation (`viewId`, `viewVersion`, `timestamp`, `sessionId`)
- deep nesting scenarios
- duplicate id/key tolerance (map overwrite semantics)
- empty view transitions
- stress case with 500 nodes
- detached value storage and restoration

---

## `src/lib/reconcile-hardening.spec.ts`

Coverage:
- migration to `null` is treated as valid migrated value
- thrown migration strategy -> `MIGRATION_FAILED` warning + carry fallback
- view hash separator-collision hardening test
- nested key-based lookup remapping
- empty-view robustness for result arrays

---

## `src/lib/reconciliation/differ.spec.ts`

Coverage:
- diff factories produce expected fields and types
- resolution factories produce expected resolution-specific shapes

---

## `src/lib/reconciliation/migrator.spec.ts`

Coverage:
- explicit strategy execution
- view-rule + strategyRegistry execution
- same-type passthrough fallback
- `kind: 'none'` when no strategy and type mismatch

---

## `src/lib/reconciliation/node-resolver.spec.ts`

Helper methods:
- `makeView(...)`
- `makeNode(...)`
- `makeData(...)`

Coverage:
- new node added
- id match carry
- key match carry
- type mismatch drop/error
- hash-change migration
- removed node detection and suppression with `allowPartialRestore`
- key-matched nodes not flagged as removed

---

## `src/lib/reconciliation/state-builder.spec.ts`

Helper methods:
- `makeView(...)`
- `makeNode(...)`
- `makeData(...)`

Coverage:
- fresh session defaults and metadata
- recursive added diffs
- blind carry on/off behavior
- result assembly merge behavior
- valueLineage carry + migrated timestamp update
- view hash deterministic behavior
- session ID format

---

## 7) Method Inventory by File (Quick Scan)

## `src/lib/context.ts`
- `buildReconciliationContext` (exported)
- `findPriorNode` (exported)
- `buildPriorValueLookupByIdAndKey` (exported)
- `determineNodeMatchStrategy` (exported)
- `indexNodesByIdAndKey` (internal)

## `src/lib/reconcile.ts`
- `reconcile` (exported)
- `reconcileViewTransition` (internal)

## `src/lib/reconciliation/differ.ts`
- `addedDiff` (exported)
- `removedDiff` (exported)
- `typeChangedDiff` (exported)
- `migratedDiff` (exported)
- `restoredDiff` (exported)
- `addedResolution` (exported)
- `carriedResolution` (exported)
- `droppedResolution` (exported)
- `migratedResolution` (exported)
- `restoredResolution` (exported)

## `src/lib/reconciliation/migrator.ts`
- `attemptMigration` (exported)

## `src/lib/reconciliation/node-resolver.ts`
- `resolveAllNodes` (exported)
- `detectRemovedNodes` (exported)
- `resolveNewNode` (internal)
- `resolveTypeMismatchedNode` (internal)
- `hasNodeHashChanged` (internal)
- `resolveHashChangedNode` (internal)
- `resolveUnchangedNode` (internal)

## `src/lib/reconciliation/state-builder.ts`
- `buildFreshSessionResult` (exported)
- `buildBlindCarryResult` (exported)
- `assembleReconciliationResult` (exported)
- `carryValueLineage` (exported)
- `computeViewHash` (exported)
- `generateSessionId` (exported)
- `collectNodesAsFreshlyAdded` (internal)
- `collectNodeIds` (internal)

## `src/lib/reconciliation/validator.ts`
- `validateNodeValue` (exported)
- `readNodeValue` (internal)
- `isEmptyValue` (internal)

## Test helper methods across specs
- `makeView` (multiple spec files)
- `makeNode` (multiple spec files)
- `makeData` (multiple spec files)

---

## 8) Behavioral Contracts and Invariants

1. ID match precedence:
   - if both ID and key could match different prior nodes, ID is chosen.

2. Type safety over carry:
   - type mismatch never carries prior value into new node value.

3. Migration fallback policy:
   - migration failure does not hard fail reconciliation; it warns and falls back to carry path for same-type transitions.

4. Detached value retention model:
   - removed/type-mismatched values are preserved in `detachedValues` with metadata.
   - later reintroduction by key+type can restore these values.

5. Optional metadata enrichment:
   - `valueLineage` and `detachedValues` omitted from result unless non-empty.

6. View hash determinism:
   - computed from sorted hash array, so node order does not change result.

7. Timestamp injection:
   - custom `clock` enables deterministic testing and replay scenarios.

---

## 9) Known Design Tradeoffs

1. Duplicate ID/key handling:
   - map indexing means last-write-wins; no explicit duplicate detection errors.

2. Session ID generation:
   - uses `Math.random()`, which is nondeterministic by design.

3. Validation extraction heuristic:
   - validator reads the `value` field from `NodeValue<T>`, which is pragmatic but shape dependent.

4. Blind carry mode:
   - intentionally allows unvalidated carry with warning (`UNVALIDATED_CARRY`) when enabled.

---

## 10) Practical Read Order for New Maintainers

Recommended sequence:
1. `README.md`
2. `src/lib/types.ts`
3. `src/lib/reconcile.ts`
4. `src/lib/context.ts`
5. `src/lib/reconciliation/node-resolver.ts`
6. `src/lib/reconciliation/migrator.ts`
7. `src/lib/reconciliation/differ.ts`
8. `src/lib/reconciliation/state-builder.ts`
9. `src/lib/reconciliation/validator.ts`
10. specs for each corresponding module

---

## 11) How to Extend Safely

When adding new reconciliation behavior:
1. Add or update issue/diff/resolution shape in a consistent way.
2. Keep resolver decisions mutually exclusive and explicit.
3. Add tests in the nearest module spec and in `reconcile.spec.ts` integration flow.
4. Preserve pure-function semantics in core reconcile path.
5. If new data metadata is introduced, merge it in `assembleReconciliationResult`.

---

## 12) Summary

`@continuum/runtime` is organized around a clear pipeline:
- context indexing -> node resolution -> removal detection -> final assembly.

The package already has broad tests for:
- edge paths,
- migration behavior,
- metadata propagation,
- resolution/diff correctness,
- nested and large-view scenarios.

This file is intended to remain a single authoritative snapshot of runtime internals. Update it when functions/files are added, removed, or behavior changes.
