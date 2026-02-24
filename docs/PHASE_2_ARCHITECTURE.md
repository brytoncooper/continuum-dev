# Phase 2: Architecture Refactor

**Status:** Complete
**Depends on:** Phase 1 (ship v0.1)
**Goal:** Decompose heavy modules, enforce SRP, improve testability and extensibility

---

## Scope

Phase 2 touches only internal architecture. The public API surface (`Session` interface, React hooks, contract types) does not change. Consumers of v0.1 should not need to change any code.

---

## 1. Session Module Decomposition

`packages/session/src/lib/session.ts` is currently ~370 lines with a single `buildSession` function that handles all lifecycle concerns.

### Implemented Structure

```
packages/session/src/lib/
  session.ts              47 lines   thin orchestrator (public)
  types.ts                unchanged  public interface
  session.spec.ts         unchanged  integration tests (64 tests)
  session/                internal modules (not re-exported)
    README.md             connection map
    session-state.ts      SessionState interface, createInitialState, generateId
    listeners.ts          snapshot/issue notification, subscription helpers
    checkpoint-manager.ts checkpoint stack, auto-checkpoint, rewind
    action-manager.ts     pending action lifecycle (submit, validate, cancel, stale)
    event-log.ts          interaction recording + state update
    schema-pusher.ts      reconciliation orchestration on schema push
    serializer.ts         serialize/deserialize with format version check
    destroyer.ts          session teardown and cleanup
```

### Migration Strategy

1. Extract each concern into its own module with a clear function signature
2. `buildSession` becomes a composition: create each manager, wire them together
3. Each module gets its own spec file
4. Integration tests in `session.spec.ts` stay as-is to verify no regression
5. New unit tests per module verify isolated behavior

### Key Decisions

- Managers are plain functions/closures, not classes (matches existing style)
- Internal state remains a single `SessionState` object passed by reference
- No new dependencies introduced

---

## 2. Reconciliation Module Decomposition

`packages/runtime/src/lib/reconcile.ts` has a ~280-line `reconcile` function doing matching, diffing, migration, and state building.

### Implemented Structure

```
packages/runtime/src/lib/
  reconcile.ts              33 lines   thin orchestrator (public)
  context.ts                92 lines   component indexing, prior value mapping, match detection
  types.ts                  unchanged
  reconcile.spec.ts         44 integration tests
  reconciliation/           internal modules (not re-exported)
    README.md               connection map
    differ.ts               pure factory functions for StateDiff and ReconciliationTrace
    migrator.ts             migration strategy resolution and application
    component-resolver.ts   per-component decision dispatch (added/type-changed/migrated/carried)
    state-builder.ts        final ReconciliationResult assembly
```

---

## 3. Constants Expansion

Phase 1 introduced `ISSUE_CODES`, `TRACE_ACTIONS`, `DIFF_TYPES`, `ISSUE_SEVERITY`, `ACTION_STATUS`. Phase 2 should:

- ~~Audit all remaining string literals across the codebase~~ Done
- ~~Add interaction type constants (`INTERACTION_TYPES.STATE_UPDATE`, etc.)~~ Done -- added to `constants.ts`
- Add event type constants if applicable (no bare event strings found to extract)
- ~~Ensure all error messages are constructable from constants + parameters (no inline strings for codes)~~ Done

---

## 4. Testing Strategy

- Every extracted module gets its own `.spec.ts` with isolated unit tests
- Existing integration tests (`session.spec.ts`, `reconcile.spec.ts`) remain unchanged as regression guards
- Target: 90%+ coverage on all new modules
- Add edge case tests that are currently missing (e.g., deeply nested children, circular key references, concurrent listener modifications)

---

## 5. Definition of Done

- [x] `session.ts` under 80 lines (orchestrator only) -- 47 lines
- [x] `reconcile.ts` under 60 lines (orchestrator only) -- 33 lines
- [x] Each extracted module under 100 lines -- largest is `serializer.ts` at 65 lines
- [x] All existing tests pass without modification -- 57 session integration + 35 reconcile integration
- [x] New unit test files for each extracted module -- 6 session module specs (38 tests) + 4 runtime module specs (31 tests)
- [x] No public API changes (Session interface, React hooks, contract types unchanged)
- [x] Build passes clean -- all 5 projects build successfully

---

## Timeline Estimate

2-3 focused days after Phase 1 ships.
