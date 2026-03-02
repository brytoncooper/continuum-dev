# `@continuum/session` Comprehensive Library Reference

This document is a deep reference for `packages/session`, intended for both humans and AI agents. It explains every file and every method/function present in the package, including internal helpers and tests.

## 1) Package Purpose and Boundary

`@continuum/session` manages the lifecycle of a Continuum session:

- tracks current view and data
- reconciles data when view versions change
- records interaction history
- manages pending intents
- supports checkpoint/restore/rewind
- serializes/deserializes complete session state
- emits snapshot/issue updates to listeners

Boundary:

- Public API is exported from `src/index.ts`.
- Internal modules under `src/lib/session/` are not exported from package root.
- Runtime behavior depends on:
  - `@continuum/contract` for shared domain types/constants
  - `@continuum/runtime` for reconciliation and optional value validation

## 2) File Inventory

Package contains:

- `package.json`
- `README.md`
- `tsconfig.json`
- `tsconfig.lib.json`
- `vitest.config.ts`
- `src/index.ts`
- `src/lib/types.ts`
- `src/lib/session.ts`
- `src/lib/session-hardening.spec.ts`
- `src/lib/session.spec.ts`
- `src/lib/session/README.md`
- `src/lib/session/intent-manager.ts`
- `src/lib/session/intent-manager.spec.ts`
- `src/lib/session/checkpoint-manager.ts`
- `src/lib/session/checkpoint-manager.spec.ts`
- `src/lib/session/destroyer.ts`
- `src/lib/session/event-log.ts`
- `src/lib/session/event-log.spec.ts`
- `src/lib/session/listeners.ts`
- `src/lib/session/listeners.spec.ts`
- `src/lib/session/view-pusher.ts`
- `src/lib/session/serializer.ts`
- `src/lib/session/serializer.spec.ts`
- `src/lib/session/session-state.ts`
- `src/lib/session/session-state.spec.ts`

## 3) Public API Summary

Public entrypoints:

- `createSession(options?)`
- `deserialize(data, options?)`
- `sessionFactory`
- all interfaces/types in `src/lib/types.ts`

Public `Session` methods:

- readers: `sessionId`, `getSnapshot`, `getIssues`, `getDiffs`, `getResolutions`, `getEventLog`, `getPendingIntents`, `getDetachedValues`, `getCheckpoints`
- view/data/intents: `pushView`, `recordIntent`, `updateState`
- intents: `submitIntent`, `validateIntent`, `cancelIntent`
- checkpointing: `checkpoint`, `restoreFromCheckpoint`, `rewind`
- lifecycle/subscriptions: `reset`, `onSnapshot`, `onIssues`, `serialize`, `destroy`

## 4) Architecture and Call Flow

Core orchestrator is `src/lib/session.ts`. It builds the public `Session` object and delegates behavior to internal modules:

- view push -> `view-pusher.pushView`
- interaction updates -> `event-log.recordIntent`
- intent lifecycle -> `intent-manager.*`
- checkpoints -> `checkpoint-manager.*`
- listeners -> `listeners.*`
- persistence -> `serializer.*`
- teardown -> `destroyer.teardownSessionAndClearState`
- state defaults/id generation/reset -> `session-state.*`

Operational lifecycle:

1. `createSession` builds empty internal state.
2. `pushView` sets current view and reconciles data.
3. `recordIntent`/`updateState` update values and event log.
4. view pushes auto-create checkpoints; manual checkpointing is also available.
5. `serialize` captures complete state; `deserialize` rebuilds state.
6. `destroy` marks session unusable and clears mutable content/listeners.

## 5) Detailed File-by-File and Method-by-Method Reference

## `package.json`

Role:

- defines package identity (`@continuum/session`)
- marks ESM (`"type": "module"`)
- points `main`, `types`, and `exports` to `src/index.ts`
- declares dependencies on `@continuum/contract` and `@continuum/runtime`
- includes Nx tag (`scope:session`)

Methods/functions:

- none

---

## `README.md`

Role:

- public-facing package guide
- quick start usage
- high-level `Session` method overview

Methods/functions documented there:

- `createSession`
- `deserialize`
- `sessionFactory`
- major `Session` methods

Methods/functions implemented there:

- none

---

## `tsconfig.json`

Role:

- local project tsconfig extending `tsconfig.lib.json`

Methods/functions:

- none

---

## `tsconfig.lib.json`

Role:

- library TypeScript build settings
- excludes tests from lib build
- references `runtime` and `contract` library configs

Methods/functions:

- none

---

## `vitest.config.ts`

Role:

- Vitest test runner config for this package

Method/function:

- default export `defineConfig(() => ({ ... }))`
  - sets root/cache directory
  - sets node test environment
  - test include globs
  - coverage provider and output path

---

## `src/index.ts`

Role:

- package root export barrel

Methods/functions:

- none

Exports:

- `./lib/session.js`
- `./lib/types.js`

---

## `src/lib/types.ts`

Role:

- defines public type contracts for options/session/factory

### Interface: `SessionOptions`

Fields:

- `clock?: () => number`
- `maxEventLogSize?: number`
- `maxPendingIntents?: number`
- `maxCheckpoints?: number`
- `reconciliation?: Omit<ReconciliationOptions, 'clock'>`
- `validateOnUpdate?: boolean`

### Interface: `Session`

Defines all public methods and the readonly `sessionId`.

### Interface: `SessionFactory`

- `createSession(options?)`
- `deserialize(data, options?)`

Methods/functions:

- none (type-only file)

---

## `src/lib/session.ts` (orchestrator and public factory)

Role:

- creates public `Session` object from private `SessionState`
- wires each public method to internal implementation modules

### Function: `assembleSessionFromInternalState(internal): Session`

Purpose:

- internal adapter from mutable internal state to safe public API facade

Public method wiring inside returned object:

- `sessionId` getter: returns `internal.sessionId`
- `getSnapshot`: returns null if destroyed, else snapshot from listeners helper
- `getIssues`/`getDiffs`/`getResolutions`/`getEventLog`/`getPendingIntents`/`getCheckpoints`: return copies or empty when destroyed
- `getDetachedValues`: returns shallow copy of `currentData.detachedValues` or empty object when unavailable/destroyed
- `pushView`: delegates to `view-pusher.pushView`
- `recordIntent`: delegates to `event-log.recordIntent`
- `updateState`: converts to `recordIntent` with `INTERACTION_TYPES.STATE_UPDATE`
- `submitIntent`/`validateIntent`/`cancelIntent`: delegate to intent manager
- `checkpoint`/`restoreFromCheckpoint`/`rewind`: delegate to checkpoint manager
- `reset`: uses `resetSessionState` if not destroyed
- `onSnapshot`/`onIssues`: delegate to listener subscription helpers
- `serialize`: delegates to serializer
- `destroy`: delegates to destroyer

Notable semantics:

- many getters return defensive copies
- all stateful behavior relies on shared `internal` reference

### Function: `createSession(options?): Session`

Purpose:

- constructs a new internal state and returns an assembled session facade

Behavior:

- resolves `clock` (`options.clock` or `Date.now`)
- generates session ID with `generateId('session', clock)`
- creates baseline state via `createEmptySessionState`
- applies optional limits and feature flags
- returns assembled session

### Function: `deserialize(data, options?): Session`

Purpose:

- reconstructs internal state from serialized blob and returns session facade

Behavior:

- calls `deserializeToState`
- passes optional override limits (`maxEventLogSize`, `maxPendingIntents`, `maxCheckpoints`)
- applies optional `reconciliation` and `validateOnUpdate` options post-deserialization

### Constant: `sessionFactory`

Role:

- object containing `{ createSession, deserialize }` for DI/factory consumption

---

## `src/lib/session/session-state.ts`

Role:

- defines mutable internal `SessionState` structure and baseline state utilities

### Interface: `SessionState`

Core fields:

- identity/config: `sessionId`, `clock`, `maxEventLogSize`, `maxPendingIntents`, `maxCheckpoints`, `reconciliationOptions`, `validateOnUpdate`
- active data: `currentView`, `currentData`, `priorView`
- diagnostics: `issues`, `diffs`, `resolutions`
- histories/stacks: `eventLog`, `pendingIntents`, `checkpoints`
- listeners: `snapshotListeners`, `issueListeners`
- lifecycle: `destroyed`

### Function: `createEmptySessionState(sessionId, clock): SessionState`

Purpose:

- produces default internal state for new sessions

Defaults:

- limits: 1000 event log, 500 pending intents, 50 checkpoints
- null view/data/priorView
- empty arrays and listener sets
- `destroyed = false`
- `validateOnUpdate = false`

### Function: `resetSessionState(internal): void`

Purpose:

- clears active session data without destroying session object

Resets:

- view/data/priorView
- issues/diffs/resolutions
- event log/pending intents/checkpoints

Does not reset:

- session ID
- clock
- limits/options
- listener sets
- destroyed flag

### Function: `generateId(prefix, clock): string`

Purpose:

- utility ID format used for sessions, interactions, intents, checkpoints

Format:

- `${prefix}_${clock()}_${randomSuffix}`

Note:

- contains timestamp and random component, not guaranteed cryptographic uniqueness

---

## `src/lib/session/listeners.ts`

Role:

- snapshot creation and listener notification/subscription management

### Function: `buildSnapshotFromCurrentState(internal): ContinuitySnapshot | null`

Returns:

- `null` unless both `currentView` and `currentData` exist
- otherwise `{ view: currentView, data: currentData }`

### Function: `notifySnapshotListeners(internal): void`

Behavior:

- builds snapshot and exits if null
- iterates `snapshotListeners` and calls each listener
- listener exceptions are swallowed; iteration continues

### Function: `notifyIssueListeners(internal): void`

Behavior:

- iterates `issueListeners`, passing a copy of `internal.issues`
- listener exceptions are swallowed; iteration continues

### Function: `notifySnapshotAndIssueListeners(internal): void`

Behavior:

- convenience helper invoking both notifier functions

### Function: `subscribeSnapshot(internal, listener): () => void`

Behavior:

- adds listener to `snapshotListeners`
- returns unsubscribe function that deletes that listener

### Function: `subscribeIssues(internal, listener): () => void`

Behavior:

- adds listener to `issueListeners`
- returns unsubscribe function that deletes that listener

---

## `src/lib/session/event-log.ts`

Role:

- records interactions and mutates current data based on interaction payload

### Function: `collectNodesById(nodes): Map<string, ViewNode>`

Purpose:

- internal view traversal helper (recursive) collecting all nodes including nested children

Usage:

- supports existence checks for target node IDs during `recordIntent`

### Function: `recordIntent(internal, partial): void`

Inputs:

- `partial` omits generated fields (`interactionId`, `timestamp`, `sessionId`, `viewVersion`)

Guards:

- no-op if destroyed or view/data not ready

Behavior flow:

1. create interaction ID/time
2. build full `Interaction` with session metadata
3. append to event log and enforce `maxEventLogSize` by trimming oldest
4. build node map; if target node missing:
   - append warning issue with `UNKNOWN_NODE`
   - notify listeners
   - return early
5. update `currentData`:
   - `values[nodeId] = payload`
   - update `lineage.timestamp` and `lineage.lastInteractionId`
   - update `valueLineage[nodeId]`
6. if `validateOnUpdate` enabled:
   - run `validateNodeValue`
   - append validation issues
7. locate latest auto checkpoint and refresh its snapshot with current snapshot
8. notify snapshot + issue listeners

Important side effects:

- event log mutation
- data mutation
- potential issue accumulation
- auto-checkpoint snapshot mutation

---

## `src/lib/session/intent-manager.ts`

Role:

- pending intent queue creation and status transitions

### Function: `submitIntent(internal, partial): void`

Guards:

- no-op if destroyed or if no `currentView`

Behavior:

- creates new `PendingIntent` with generated ID/timestamp/current view version
- sets status to `INTENT_STATUS.PENDING`
- appends to `internal.pendingIntents`
- enforces `maxPendingIntents` by trimming oldest entries

### Function: `validateIntent(internal, intentId): boolean`

Behavior:

- finds intent by ID
- returns `false` if missing
- otherwise sets status to `VALIDATED` and returns `true`

### Function: `cancelIntent(internal, intentId): boolean`

Behavior:

- finds intent by ID
- returns `false` if missing
- otherwise sets status to `CANCELLED` and returns `true`

### Function: `markAllPendingIntentsAsStale(internal): void`

Behavior:

- transitions only intents currently in `PENDING` state to `STALE`
- leaves `VALIDATED`/`CANCELLED` unchanged

Used by:

- view push on version change

---

## `src/lib/session/checkpoint-manager.ts`

Role:

- checkpoint creation and state rewind/restore mechanics

### Function: `cloneCheckpointSnapshot(value): T`

Behavior:

- deep clone via JSON stringify/parse

Implications:

- serializable data only
- strips non-JSON types

### Function: `autoCheckpoint(internal): void`

Behavior:

- builds current snapshot and returns if missing
- creates `trigger: 'auto'` checkpoint with:
  - generated ID
  - session ID
  - deep-cloned snapshot
  - current event log length as `eventIndex`
  - timestamp
- enforces `maxCheckpoints` by removing oldest auto checkpoints first

Retention detail:

- removal loop removes first `trigger === 'auto'` entries until within limit
- manual checkpoints are preserved by this strategy

### Function: `createManualCheckpoint(internal): Checkpoint`

Behavior:

- requires active snapshot, else throws:
  - `Cannot create checkpoint before pushing a view`
- creates `trigger: 'manual'` checkpoint
- appends to stack and returns it

### Function: `restoreFromCheckpoint(internal, cp): void`

Guards:

- no-op if destroyed

Behavior:

- deep-clones checkpoint view/data into current view/data
- clears `priorView`
- truncates event log to checkpoint `eventIndex`
- clears issues/diffs/resolutions
- clears pending intents
- notifies snapshot and issue listeners

### Function: `rewind(internal, checkpointId): void`

Guards:

- no-op if destroyed
- throws if checkpoint ID not found

Behavior:

- finds checkpoint index
- trims checkpoint stack to that checkpoint (inclusive)
- restores view/data and clears diagnostics/intents similarly to `restoreFromCheckpoint`
- truncates event log to checkpoint `eventIndex`
- notifies listeners

Difference vs restore:

- `rewind` also truncates checkpoint stack
- `restoreFromCheckpoint` keeps full stack

---

## `src/lib/session/view-pusher.ts`

Role:

- view validation, reconciliation, stale-intent marking, auto-checkpointing, notifications

### Function: `assertValidView(view): void`

Validation rules:

- `viewId` must be non-empty string
- `version` must be non-empty string
- `nodes` must be array

Throws descriptive errors on invalid input.

### Function: `pushView(internal, view): void`

Guards:

- no-op if destroyed

Behavior flow:

1. validate view shape
2. capture prior version and set `priorView`/`currentView`
3. run `reconcile` from runtime using:
   - new view
   - prior view
   - current data
   - merged options `{ clock, ...reconciliationOptions }`
4. set `currentData` from reconciliation result and force `lineage.sessionId` to internal session ID
5. set `issues`, `diffs`, `resolutions` from reconciliation result
6. if view version changed from previous, mark pending intents stale
7. create auto-checkpoint
8. notify snapshot/issue listeners

Key invariant:

- after successful push, session data reflects reconcile result for active view

---

## `src/lib/session/serializer.ts`

Role:

- persistence format management and validation for deserialize path

Constants:

- `CURRENT_FORMAT_VERSION = 1`

### Function: `deepClone(value): T`

- JSON deep-clone helper used by serializer

### Function: `serializeSession(internal): unknown`

Returns cloned object containing:

- `formatVersion`
- `sessionId`
- `currentView`, `currentData`, `priorView`
- `eventLog`, `pendingIntents`, `checkpoints`
- `issues`, `diffs`, `resolutions`
- `settings`:
  - `allowBlindCarry`
  - `allowPartialRestore`
  - `validateOnUpdate`

Properties:

- detached from internal references
- JSON-serializable

### Interface: `SerializedSessionData`

Internal shape used for typed validation/assertion in deserialize path.

### Function: `isRecord(value): value is Record<string, unknown>`

- runtime guard for object-like non-null values

### Function: `assertArrayField(data, field): void`

- throws if provided field exists but is not an array

### Function: `assertObjectOrNullField(data, field): void`

- throws if provided field exists and is neither object nor null

### Function: `validateSerializedSessionData(data): asserts data is SerializedSessionData`

Checks:

- payload is object
- `sessionId` is string
- optional `formatVersion` is number
- object-or-null fields valid
- collection fields are arrays when present

Throws descriptive errors for invalid data.

### Function: `deserializeToState(data, clock, limits?): SessionState`

Behavior flow:

1. validate structure with `validateSerializedSessionData`
2. reject unsupported format versions (`formatVersion` must be `1` when present)
3. construct `SessionState` object with:
   - restored fields or safe defaults
   - new `clock` from argument
   - limits from `limits` arg or defaults
   - reconciliation options from serialized `settings`
   - empty listener sets
   - `destroyed = false`

Legacy handling:

- accepts data without `formatVersion`
- defaults missing arrays to empty

---

## `src/lib/session/destroyer.ts`

Role:

- terminal teardown logic for session state

### Function: `teardownSessionAndClearState(internal): { issues: ReconciliationIssue[] }`

Behavior:

1. set `destroyed = true`
2. null view/data/priorView
3. clear event log, pending intents, checkpoints
4. snapshot current issues into return value
5. clear issues/diffs/resolutions
6. clear listener sets
7. return captured issues

Post-condition:

- public getters in orchestrator report empty/null values
- future operations generally no-op due to destroyed checks

---

## `src/lib/session/README.md`

Role:

- internal maintainer notes describing module responsibilities and data flow

Methods/functions:

- none

---

## `src/lib/session.spec.ts` (integration-style behavior coverage)

Role:

- validates cross-module session behavior via public API

Helper methods in file:

### `makeView(nodes, id = 'view-1', version = '1.0')`

- creates compact `ViewDefinition` test fixtures

### `makeNode(overrides)`

- creates compact `ViewNode` fixtures

Behavior areas covered:

- lifecycle (`createSession`, `destroy`, `reset`)
- view reconciliation and listener notifications
- detached value exposure
- interaction recording and data lineage updates
- pending intent transitions and stale behavior
- checkpoint creation/restore/rewind semantics
- deterministic clock behavior
- reconciliation resolution retrieval
- serialization/deserialization and formatVersion behavior
- edge cases in listener mutation and rapid view pushes

---

## `src/lib/session-hardening.spec.ts` (robustness and regression-focused tests)

Role:

- additional hardening scenarios and safety properties

Fixture constants:

- `viewV1`
- `viewV2`

Scenarios covered:

- manual checkpoint creation and rewind
- pre-view checkpoint error handling
- listener failure isolation
- targeted state updates and listener notifications
- destroy-time data clearing
- boolean return contracts for `validateIntent`/`cancelIntent`
- view shape validation errors
- serialization detachment from internal state
- full round-trip parity for snapshot/events/intents/checkpoints/diagnostics
- checkpoint snapshot immutability after later updates
- diagnostic clearing on rewind
- option limits (`maxEventLogSize`, `maxPendingIntents`)

---

## `src/lib/session/intent-manager.spec.ts`

Role:

- unit tests for intent manager functions

Functions exercised:

- `submitIntent`
- `validateIntent`
- `cancelIntent`
- `markAllPendingIntentsAsStale`

Key assertions:

- view/destroy guards
- status transitions
- stale marking excludes validated/cancelled intents

---

## `src/lib/session/checkpoint-manager.spec.ts`

Role:

- unit tests for checkpoint manager

Helper method:

### `setupWithSnapshot(internal)`

- seeds view/data fixture into internal state

Functions exercised:

- `autoCheckpoint`
- `createManualCheckpoint`
- `restoreFromCheckpoint`
- `rewind`

Key assertions:

- creation behavior and null-snapshot no-op
- restore clearing of diagnostics/intents
- destroyed guard behavior
- deep clone isolation from checkpoint mutation
- unknown checkpoint throw behavior

---

## `src/lib/session/event-log.spec.ts`

Role:

- unit tests for event recording behavior

Helper method:

### `setupWithView(internal)`

- seeds minimal view/data fixture

Function exercised:

- `recordIntent`

Key assertions:

- event append
- data/value/lineage updates
- listener notification
- destroyed/no-data guard no-ops

---

## `src/lib/session/listeners.spec.ts`

Role:

- unit tests for snapshot/issue listener helpers

Helper methods:

### `makeView()`

- returns test view fixture

### `makeData()`

- returns test data fixture

Functions exercised:

- `buildSnapshotFromCurrentState`
- `notifySnapshotListeners`
- `notifyIssueListeners`
- `notifySnapshotAndIssueListeners`

Key assertions:

- null-return scenarios
- listener invocation counts
- issue payload cloning

---

## `src/lib/session/serializer.spec.ts`

Role:

- unit tests for serialization/deserialization internals

Functions exercised:

- `serializeSession`
- `deserializeToState`

Key assertions:

- JSON serializability
- formatVersion value and rejection of unsupported versions
- legacy/no-version support
- defaults for missing collections
- validation error paths for malformed payloads

---

## `src/lib/session/session-state.spec.ts`

Role:

- unit tests for baseline state factory and ID generation

Functions exercised:

- `createEmptySessionState`
- `generateId`

Key assertions:

- correct initialization of all fields
- prefix/timestamp ID structure
- uniqueness across repeated calls

## 6) Method Behavior Matrix (Public API)

### `createSession(options?)`

- creates new session with fresh ID and clean state
- accepts deterministic clock and tuning options

### `deserialize(data, options?)`

- rebuilds a session from serialized blob
- throws on unsupported forward format versions

### `session.sessionId`

- immutable ID accessor

### `session.getSnapshot()`

- returns `null` before first view push or after destroy
- otherwise current `{ view, data }`

### `session.getIssues()`, `session.getDiffs()`, `session.getResolutions()`

- return arrays from latest reconciliation context
- empty after destroy

### `session.pushView(view)`

- validates shape, reconciles, updates diagnostics/resolutions/diffs
- marks pending intents stale on version change
- auto-checkpoints and notifies listeners

### `session.recordIntent(interaction)`

- appends interaction with generated metadata
- updates data value/lineage for target node
- optionally validates node value on update

### `session.updateState(nodeId, payload)`

- shorthand for `recordIntent` with `STATE_UPDATE` interaction type

### `session.getEventLog()`

- returns interaction history copy

### `session.submitIntent(intent)`

- appends pending intent stamped with current view version

### `session.validateIntent(intentId)`

- sets intent status to validated, returns success boolean

### `session.cancelIntent(intentId)`

- sets intent status to cancelled, returns success boolean

### `session.getPendingIntents()`

- returns pending intent list copy

### `session.getDetachedValues()`

- returns current data's detached values map (copy)

### `session.checkpoint()`

- creates manual checkpoint; throws if no active snapshot

### `session.restoreFromCheckpoint(cp)`

- restores view/data/event index and clears diagnostics/intents

### `session.getCheckpoints()`

- returns checkpoint stack copy

### `session.rewind(checkpointId)`

- restores to checkpoint and truncates checkpoint stack
- throws on unknown checkpoint ID

### `session.reset()`

- clears session data but keeps session alive/configured

### `session.onSnapshot(listener)`, `session.onIssues(listener)`

- register listener and return unsubscribe callback

### `session.serialize()`

- returns detached JSON-compatible state blob with `formatVersion: 1`

### `session.destroy()`

- marks session destroyed, clears mutable state/listeners
- returns final issues snapshot

## 7) State, Limits, and Lifecycle Semantics

Limits:

- `maxEventLogSize`: trims oldest interactions beyond limit
- `maxPendingIntents`: trims oldest pending intents beyond limit
- `maxCheckpoints`: enforced on auto-checkpoints; favors keeping manual checkpoints

Destroyed behavior:

- most mutating methods no-op after destroy
- getters return null/empty values after destroy

Reset vs destroy:

- `reset`: reusable session, same ID/options/listeners preserved
- `destroy`: terminal state, listeners cleared, methods mostly inert

## 8) Data Compatibility and Format Notes

Serialization format:

- current format version is `1`
- includes `settings` for selected reconciliation/update behaviors

Deserialize compatibility:

- accepts older/no-format payloads
- rejects unknown future format versions
- normalizes legacy checkpoints lacking `trigger`

## 9) Observed Guarantees from Tests

The test suite demonstrates these practical guarantees:

- deterministic behavior when custom clock is injected
- event order preservation in event log
- listener isolation from thrown errors
- rewind/restore clears diagnostics and pending intents
- checkpoint snapshots are isolated from future mutations
- serialized payloads are detached copies (tampering with payload does not mutate session)
- edge cases around listener subscribe/unsubscribe timing are handled

## 10) Notes for AI Agents and Future Maintainers

When modifying this library:

- treat `src/lib/session.ts` as API wiring layer, and keep business logic in internal modules
- preserve destroyed guards and defensive copies
- keep reconciliation metadata (`issues`, `diffs`, `resolutions`) in sync on view changes
- preserve serialization compatibility and bump format only with migration plan
- ensure checkpoint semantics remain consistent:
  - auto checkpoints on view push
  - manual checkpoint API preserved
  - rewind trims stack, restore does not
- update or extend relevant unit/integration tests when behavior changes

This file is intentionally exhaustive. If new files or methods are added to `packages/session`, update this reference in the same change.
