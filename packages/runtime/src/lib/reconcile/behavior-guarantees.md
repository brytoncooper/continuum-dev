# Reconcile Behavior Guarantees

This document separates stable expectations from implementation details. Statements are grounded in current reconcile source and existing specs.

## Contracted Runtime Behavior

These are part of the reconcile function contract as currently implemented:

- Reconcile returns `reconciledState`, `diffs`, `issues`, and `resolutions`
- Preferred API call shape is object-form:
  - `reconcile({ newView, priorView, priorData, options })`
- Positional call shape remains supported but deprecated:
  - `reconcile(newView, priorView, priorData, options)`
- Branching behavior is determined by `(priorData, priorView)` shape:
  - no prior data -> fresh session
  - prior data without prior view -> blind carry path
  - prior data and prior view -> full transition path
- Timestamp resolution is deterministic:
  - `options.clock()` when supplied
  - otherwise `priorData.lineage.timestamp + 1` when prior data exists
- Fresh sessions require a clock if no prior data is available

## Tested Guarantees

## Branch and Matching Guarantees

Backed by `core.spec.ts`:

- Fresh session emits `NO_PRIOR_DATA` info and initializes node state deterministically
- Blind-carry path emits `NO_PRIOR_VIEW` warning
- With `allowBlindCarry`, values carry by exact indexed node IDs only
- Match precedence behaves as scoped ID, then unique semantic key, then scoped key
- Key-based matching preserves carry across ID renames when scoped key identity is stable

## Diff and Resolution Guarantees

Backed by `core.spec.ts` and `stress.spec.ts`:

- Added nodes produce `added` diffs
- Removed nodes produce `removed` diffs and detached-value entries
- Type-incompatible transitions produce `type-changed` outcomes and prevent unsafe carry
- Resolutions exist for each node in the new view and report match strategy and result
- Same-push add/remove pairs can be rewritten to `restored` outcomes when detached key and type are compatible

## Detached Values and Restoration

Backed by `core.spec.ts` and multi-push stress scenarios:

- Removed node data is persisted to `detachedValues`
- Detached values accumulate across pushes
- Compatible reappearance by key and type restores detached value into active values
- Restored detached keys are removed from final detached-value map

## Semantic Key Cross-Level Guarantees

Backed by `semantic-key.spec.ts` and planner specs:

- Top-level to collection migration occurs only when source disappears on top level and unique same-type destination exists in collection scope
- Collection to top-level migration occurs only when source disappears in collection scope and unique same-type destination exists on top level
- Top-to-collection applies across existing collection items
- Collection-to-top reads first-item value deterministically
- Cross-level migrations emit `migrated` diffs on affected destination nodes
- Type mismatch blocks semantic-key migration

## Collection and Restructure Guarantees

Backed by `stress.spec.ts`:

- Template path remaps preserve collection item values across container renames when identity gates allow matching
- Nested collections reconcile recursively through restructures
- Container swaps among compatible container types preserve child value carry
- Constraint updates (`minItems`, `maxItems`) normalize collection state deterministically

## Hardening and Safety Guarantees

Backed by `hardening.spec.ts` and `stress.spec.ts`:

- Traversal reports cycle and max-depth issues
- Duplicate IDs/keys produce duplicate issues while preserving deterministic last-write-wins indexing behavior
- Malformed collection payloads are normalized safely
- Migration strategy exceptions are captured as `MIGRATION_FAILED` and reconcile continues
- `null` migrated values are accepted

## Determinism Guarantees

Backed by `core.spec.ts`, `stress.spec.ts`, and `semantic-key.spec.ts`:

- Identical inputs produce identical outputs across repeated runs
- Stable view/data inputs converge to stable outputs on repeated reconciliation
- Output does not depend on incidental node ordering for covered scenarios

## Non-Guarantees and Implementation Details

These are current behavior, but not yet formalized as stable API guarantees:

- Exact diff ordering across categories (`resolved` diffs then `removal` diffs)
- Rationale for first-item selection policy in collection-to-top extraction
- Full precedence documentation for interactions between standard carry, same-push restore, and semantic-key post-processing when multiple mechanisms could apply
- Internal indexing structures and helper naming in `context` and `reconciliation` modules

## Source and Spec Anchors

- Runtime flow:
  - `packages/runtime/src/lib/reconcile/reconcile-core.ts`
  - `packages/runtime/src/lib/reconcile/transition.ts`
  - `packages/runtime/src/lib/reconcile/semantic-moves/semantic-key-moves.ts`
- Primary specs:
  - `packages/runtime/src/lib/reconcile/core.spec.ts`
  - `packages/runtime/src/lib/reconcile/stress.spec.ts`
  - `packages/runtime/src/lib/reconcile/semantic-key.spec.ts`
  - `packages/runtime/src/lib/reconcile/hardening.spec.ts`

