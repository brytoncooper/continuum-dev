# Session Internals

This folder contains the internal session implementation behind `@continuum-dev/session`.

These modules are not published as stable subpath APIs. They are composed by the root `createSession(...)` and `deserialize(...)` entrypoints.

## Public Boundary

Stable package entrypoints:

- `packages/session/src/index.ts`
- `packages/session/src/lib/session.ts`
- `packages/session/src/lib/types.ts`

Everything under `src/lib/session/*` is internal implementation detail.

## High-Level Shape

Session is composed from several focused facades over one mutable `SessionState`.

`src/lib/session.ts` does not build one giant class. It creates empty internal state, then layers facade methods on top of that shared state.

Current composition:

- `state/facade.ts`
  - snapshot access, checkpoints, serialize, reset, destroy
- `interactions/facade.ts`
  - updates, intents, proposals, actions
- `streams/facade.ts`
  - stream lifecycle
- `listeners/facade.ts`
  - subscriptions plus latest issues/diffs/resolutions
- `updates/facade.ts`
  - `pushView`, focus, detached values
- `restore-reviews/facade.ts`
  - restore review workflows and scoped updates

## Core Session Model

The internal `SessionState` tracks:

- committed `currentView` and `currentData`
- `priorView`
- latest `issues`, `diffs`, and `resolutions`
- `eventLog`
- `pendingIntents`
- `checkpoints`
- `pendingProposals`
- registered actions
- active and historical stream metadata
- approved and rejected restore-review state
- current focus

Important distinction:

- `buildCommittedSnapshotFromCurrentState(...)`
  - durable committed `{ view, data }`
- `buildRenderSnapshotFromCurrentState(...)`
  - render snapshot, including an active foreground stream when present

That distinction powers the public difference between `getCommittedSnapshot()` and `getSnapshot()`.

## Main Data Flows

### Session Creation

`createSession(options?)`:

1. resolves the session clock,
2. creates empty `SessionState`,
3. applies limits, reconciliation options, validation settings, detached-value policy, restore-review enablement, and pre-registered actions,
4. optionally attaches persistence,
5. composes the public `Session` object from facades.

`deserialize(data, options?)` follows the same composition path after rebuilding internal state from serialized data.

### View Push Flow

`pushView(...)` lives in `updates/view-pusher.ts`.

Non-transient push flow:

1. call runtime `applyContinuumViewUpdate(...)`,
2. update committed `currentView` / `currentData`,
3. replace latest `issues`, `diffs`, and `resolutions`,
4. sync focus to the current render tree,
5. mark pending intents as stale when the stable view version changed,
6. update `stableViewVersion`,
7. create an automatic checkpoint,
8. run detached-value GC,
9. notify snapshot and issue listeners.

Transient pushes skip the stable-version, checkpoint, and detached-GC side effects.

### Interaction And State Update Flow

`updateState(...)` is a convenience wrapper around `recordIntent(...)` with interaction type `data-update`.

`recordIntent(...)`:

1. validates the interaction type,
2. tries render-only stream handling when possible,
3. appends an interaction record to the event log,
4. applies the value through runtime `applyContinuumNodeValueWrite(...)`,
5. updates the committed snapshot,
6. syncs committed values into compatible streams,
7. deduplicates issues by `nodeId + code`,
8. refreshes the latest automatic checkpoint snapshot,
9. notifies listeners.

## Streams

The streams subsystem lives under `session/streams`.

Core behavior:

- `beginStream(...)`
  - creates an open stream for one target view id
- `applyStreamPart(...)`
  - updates the stream working view/data
- `commitStream(...)`
  - promotes the stream working state into committed session state
- `abortStream(...)`
  - discards the stream and optionally stores render-only detached values

Important rules enforced today:

- only one open stream per `targetViewId` unless superseded,
- only one active foreground stream at a time,
- foreground streams affect render snapshots,
- draft streams stay out of render snapshots,
- stale commits fail deterministically when their base view is no longer current,
- open stream overlays are not serialized.

`part-application.ts` is the core interpreter for:

- full streamed views,
- streamed structural parts,
- streamed state writes,
- stream status parts,
- node-status parts.

## Persistence And Hydration

Persistence lives under `session/state/persistence.ts`.

Current behavior:

- snapshot persistence is triggered from snapshot notifications,
- writes are debounced by 200ms,
- pending writes flush on `beforeunload`,
- matching browser `storage` events are deserialized back into the active session,
- remote hydration uses `replaceInternalState(...)`,
- stream overlays and focus are intentionally not restored from serialized state.

Serialization lives in `session/state/serializer.ts`.

Current persisted payload includes:

- `formatVersion`
- session id
- committed current view/data
- prior view
- event log
- pending intents
- checkpoints
- issues / diffs / resolutions
- selected settings

It intentionally strips legacy `viewContext` fields and does not persist active streams.

## Checkpoints

Checkpoint logic lives in `session/state/checkpoint-manager.ts`.

Current behavior:

- non-transient `pushView(...)` creates an automatic checkpoint,
- manual checkpoints require an existing committed snapshot,
- rewind truncates checkpoint history after the selected checkpoint,
- restore does not truncate the checkpoint stack,
- both rewind and restore clear issues, diffs, resolutions, pending intents, and streams,
- focus is revalidated after restore/rewind.

Pruning policy:

- auto checkpoints are pruned first for auto overflow,
- manual checkpoints are pruned first for manual overflow.

## Proposals, Intents, And Actions

### Proposals

Proposal behavior lives in `interactions/facade.ts`.

Current behavior:

- `proposeValue(...)` asks runtime `decideContinuumNodeValueWrite(...)`
- clean values apply immediately through `recordIntent(...)`
- protected values become staged proposals in `pendingProposals`
- `acceptProposal(...)` reapplies the proposed value as a data update and keeps it dirty
- `rejectProposal(...)` clears the proposal without changing current value

### Intents

Intent queue behavior lives in `interactions/intent-manager.ts`.

Current behavior:

- submit -> `pending`
- validate -> `validated`
- cancel -> `cancelled`
- view-version change on non-transient push can mark unresolved pending intents as `stale`

### Actions

Action registration and dispatch also live in `interactions/facade.ts`.

Current behavior:

- handlers are stored in `actionRegistry`
- `dispatchAction(...)` returns `{ success: false }` when no handler or snapshot exists
- handler failures are caught and returned as failed `ActionResult`
- `executeIntent(...)` bridges intent submission with action dispatch and status updates

## Restore Reviews

Restore-review orchestration lives under `session/restore-reviews`.

Current behavior:

- reviews are generated only when restore reviews are enabled,
- reviews can target the live committed scope or a draft stream scope,
- accepting a candidate applies the detached value into that scope,
- rejecting a review stores rejection state keyed by review id,
- approvals can be cleared by scope.

This subsystem builds on runtime detached values and runtime restore-candidate scoring, but it is session-owned orchestration.

## Directory Map

| Path | Responsibility |
| --- | --- |
| `state/` | internal state model, ids, checkpoints, serializer, persistence, destroy/reset |
| `listeners/` | committed/render snapshot builders and all listener wiring |
| `updates/` | view push orchestration, focus sync, detached-value access |
| `interactions/` | record/update flows, proposals, intents, actions |
| `streams/` | stream lifecycle, part application, draft/foreground overlay state |
| `restore-reviews/` | candidate review orchestration for detached-value reattachment |
| `focus.ts` | focus resolution and render-tree resync |
| `node-lookup.ts` | internal alias to runtime lookup helpers |

## Test Anchors

Primary behavior coverage lives in:

- `src/lib/session.spec.ts`
- `src/lib/session-hardening.spec.ts`
- `src/lib/session/proposals.spec.ts`
- `src/lib/session/listeners/listeners.spec.ts`
- `src/lib/session/streams/streams.spec.ts`
- `src/lib/session/state/persistence.spec.ts`
- `src/lib/session/state/serializer.spec.ts`
- `src/lib/session/state/session-state.spec.ts`

When behavior changes, keep this README aligned with those tests.
