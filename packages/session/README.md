# @continuum-dev/session

```bash
npm install @continuum-dev/session
```

## Why It Exists

`@continuum-dev/runtime` solves continuity for one structural update.

`@continuum-dev/session` exists when you need continuity across a whole timeline.

That means problems like:

- keeping the latest view and canonical data together across many pushes,
- protecting user input when AI or system updates arrive later,
- checkpointing and rewinding state,
- persisting a session and restoring it later,
- rendering foreground stream updates before they are committed,
- tracking pending intents, proposals, detached values, and restore reviews.

If runtime is the stateless continuity engine, session is the stateful continuity manager built around it.

## How It Works

Session keeps a mutable ledger around runtime reconciliation.

At a high level it tracks:

- the committed `view` and canonical `data`,
- the current render snapshot,
- an interaction log,
- pending intents and proposals,
- checkpoints,
- detached values,
- optional stream overlays,
- optional persistence wiring.

The normal session loop is:

1. create a session,
2. push the first view,
3. let users update node state,
4. push later views as the UI changes,
5. let session reconcile through `@continuum-dev/runtime`,
6. optionally persist, rewind, stream, or dispatch actions.

On each non-transient `pushView(...)`, session:

- calls runtime reconciliation through `applyContinuumViewUpdate(...)`,
- updates the committed snapshot,
- records latest issues, diffs, and resolutions,
- marks unresolved pending intents as stale when the stable view version changes,
- creates an automatic checkpoint,
- applies detached-value garbage collection,
- revalidates focus against the current render tree.

## What It Is

`@continuum-dev/session` is a headless TypeScript session lifecycle manager built on top of `@continuum-dev/runtime`.

It is the package you use when you want one object that owns:

- structural pushes,
- user updates,
- session snapshots,
- checkpoints,
- persistence,
- action dispatch,
- streaming,
- proposal and restore-review flows.

Everything is exported from the package root. Most users start with:

```ts
import {
  createSession,
  deserialize,
  hydrateOrCreate,
} from '@continuum-dev/session';
```

## Simplest Way To Use It

Most apps should start with:

- `createSession(...)`
- `session.pushView(view)`
- `session.updateState(nodeId, value)`
- `session.getSnapshot()`

### Minimal Flow

```ts
import { createSession } from '@continuum-dev/session';

// Optional: use a monotonic clock when you want deterministic ordering.
let tick = 0;
const now = () => ++tick;

// Create one session object for the whole interaction timeline.
const session = createSession({ clock: now });

// First push: this establishes the first committed snapshot.
session.pushView({
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'email',
      type: 'field',
      dataType: 'string',
      semanticKey: 'person.email',
    },
  ],
});

// Read the current render snapshot.
// Without streams, getSnapshot() and getCommittedSnapshot() are the same.
let snapshot = session.getSnapshot();

// User input updates canonical session data.
session.updateState('email', {
  value: 'alice@example.com',
  isDirty: true,
});

// Later the UI changes shape, but the same semantic field still exists.
session.pushView({
  viewId: 'profile',
  version: '2',
  nodes: [
    {
      id: 'contact',
      type: 'group',
      children: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          semanticKey: 'person.email',
        },
      ],
    },
  ],
});

// The latest snapshot now reflects the reconciled state.
snapshot = session.getSnapshot();

// Optional: serialize the durable session state for later restore.
const serialized = session.serialize();
```

### Normal Session Order

The easiest mental model is:

1. create the session once,
2. push the first view before expecting a snapshot,
3. read `getSnapshot()` or subscribe with `onSnapshot(...)`,
4. apply user edits with `updateState(...)`,
5. push later views with `pushView(...)`,
6. use the latest session state as the input to the next turn,
7. optionally serialize, persist, rewind, or stream.

Each session call updates the state the next session call should build on.

### `getSnapshot()` Versus `getCommittedSnapshot()`

This distinction matters only when streams are active.

- `getSnapshot()`
  - the current renderable snapshot
  - includes an active foreground stream overlay when one exists
- `getCommittedSnapshot()`
  - the last durable committed `{ view, data }` pair
  - ignores open stream overlays

If you are not using streams, they are effectively the same.

### About `clock`

Unlike runtime, session does not require you to pass a clock.

If you omit it, session uses `Date.now`.

You should know what the clock is used for, though, because session timestamps more than one thing:

- session ids,
- interaction timestamps,
- intent queue times,
- checkpoint timestamps,
- stream timestamps,
- proposal timestamps,
- detached-value age checks,
- restore approvals.

For most apps:

- `Date.now` is fine,
- you can just call `createSession()` with no options.

Use a custom monotonic clock when you want:

- deterministic tests,
- explicit event ordering,
- app-level sequencing that does not depend on wall-clock time.

Simple example:

```ts
let tick = 0;
const now = () => ++tick;

const session = createSession({ clock: now });
```

If you deserialize later and want to keep using the same kind of ordering, pass the same clock style to `deserialize(...)` or `hydrateOrCreate(...)`.

### What Is Required

For the normal session path you need:

- a session created by `createSession(...)`,
- a valid first view pushed with `pushView(...)`,
- later view pushes if the UI structure changes,
- `updateState(...)` or `recordIntent(...)` for ongoing input.

Optional but common:

- `clock`
  - defaults to `Date.now`
- `persistence`
  - if you want automatic storage
- `actions`
  - if you want intent dispatch handlers

### What To Persist

The easiest manual persistence path is:

- `const blob = session.serialize()`
- `const restored = deserialize(blob, options?)`

If you want automatic persistence, use `createSession({ persistence })` or `hydrateOrCreate({ persistence })`.

## Other Options

### Persistence And Hydration

Manual persistence:

```ts
const blob = session.serialize();
const restored = deserialize(blob);
```

Automatic persistence:

```ts
const session = hydrateOrCreate({
  persistence: {
    storage: localStorage,
    key: 'loan_session',
  },
});
```

Current persistence behavior:

- writes are debounced by 200ms,
- pending writes flush on `beforeunload`,
- matching browser `storage` events can hydrate remote tab updates back into the active session,
- persisted payloads use `formatVersion: 1`,
- `maxBytes` can reject oversized writes before they hit storage,
- `onError` receives `size_limit` or `storage_error`,
- active stream overlays, focus, and action handlers are not serialized.

If you restore with `deserialize(...)` or `hydrateOrCreate(...)` and still need actions, pass `actions` again in the options.

### Checkpoints And Rewind

Session automatically creates checkpoints on non-transient `pushView(...)`.

You can also manage them directly:

```ts
const cp = session.checkpoint();
session.rewind(cp.checkpointId);
session.restoreFromCheckpoint(cp);
```

Use these when you need undo, time-travel, or “return to a known good state” workflows.

### Proposals Instead Of Clobbering

Use proposals when an AI or system-authored value should not silently overwrite protected user state.

```ts
session.proposeValue('email', { value: 'ai@example.com' }, 'ai');

const proposals = session.getPendingProposals();
session.acceptProposal('email');
session.rejectProposal('email');
```

If the current value is clean, the proposal may apply immediately. If it is dirty or otherwise protected, session stages it instead.

### Streams

Use streams when you want to show partial AI updates before they are committed.

```ts
const stream = session.beginStream({
  targetViewId: 'profile',
  mode: 'foreground',
});

session.applyStreamPart(stream.streamId, {
  kind: 'append-content',
  nodeId: 'intro',
  text: ' world',
});

session.commitStream(stream.streamId);
```

Important stream rules:

- foreground streams affect `getSnapshot()`,
- draft streams do not affect `getSnapshot()`,
- committed state does not change until `commitStream(...)`,
- stale or aborted streams do not become durable state,
- user edits made against render-only nodes can survive commit and can detach on abort.

### Structural Push Options

`pushView(view, options?)` supports advanced options through `SessionViewApplyOptions`:

- `transformPlan`
  - apply a runtime transform plan during reconciliation
- `transient`
  - update the session view/data without advancing stable timeline behavior such as auto-checkpointing

### Intents And Actions

If your UI emits semantic intents, use the intent and action APIs:

```ts
session.submitIntent({
  nodeId: 'submit_btn',
  intentName: 'submit_form',
  payload: { source: 'user' },
});

session.registerAction(
  'submit_form',
  { label: 'Submit' },
  async ({ snapshot }) => ({ success: true, data: snapshot.values })
);

const result = await session.executeIntent({
  nodeId: 'submit_btn',
  intentName: 'submit_form',
  payload: { source: 'user' },
});
```

This gives you:

- pending intent tracking,
- validation/cancellation lifecycle,
- handler registration,
- dispatch against the current session snapshot.

### Restore Reviews

If restore reviews are enabled, session can surface possible destinations for detached values instead of only preserving them silently.

```ts
const reviews = session.getPendingRestoreReviews();
session.acceptRestoreCandidate(detachedKey, targetNodeId, { kind: 'live' });
session.rejectRestoreReview(detachedKey, { kind: 'live' });
```

Restore reviews can target:

- the live committed session,
- or a draft stream scope.

### Listeners

You can subscribe to the moving parts you care about:

```ts
session.onSnapshot((snapshot) => {});
session.onStreams((streams) => {});
session.onIssues((issues) => {});
session.onFocusChange((focusedNodeId) => {});
```

## Internal Docs

If you are maintaining or extending the package, start here:

- [Session internals](./src/lib/session/README.md)

## Related Packages

- `@continuum-dev/runtime` performs the structural reconciliation session builds on.
- `@continuum-dev/contract` defines the canonical view and snapshot model.
- `@continuum-dev/react` and `@continuum-dev/angular` can wrap session for framework-driven usage.

## Dictionary Contract

### Core Terms

- `session`
  - the stateful object that owns the continuity timeline
- `snapshot`
  - the current renderable `{ view, data }`
- `committed snapshot`
  - the last durable `{ view, data }` pair
- `event log`
  - recorded interaction history
- `pending intent`
  - a queued semantic intent awaiting validation or cancellation
- `proposal`
  - a staged value that did not overwrite protected current state
- `checkpoint`
  - a durable restore point in the timeline
- `stream`
  - an in-progress overlay of partial updates
- `detached value`
  - preserved data that no longer has a safe active node
- `restore review`
  - a suggested target for reattaching a detached value

### `PendingIntent.status`

Exact values:

```ts
'pending' | 'validated' | 'stale' | 'cancelled'
```

### `Checkpoint.trigger`

Exact values:

```ts
'auto' | 'manual'
```

### `SessionStream.mode`

Exact values:

```ts
'foreground' | 'draft'
```

### `SessionStream.status`

Exact values:

```ts
'open' | 'committed' | 'aborted' | 'stale' | 'superseded'
```

### `SessionStreamStatusLevel`

Exact values:

```ts
'info' | 'success' | 'warning' | 'error'
```

### `DetachedRestoreScope.kind`

Exact values:

```ts
'live' | 'draft'
```

### `DetachedRestoreReview.status`

Exact values:

```ts
'waiting' | 'candidates' | 'approved'
```

### `Interaction.type`

Exact exported values:

```ts
'data-update' | 'value-change' | 'view-context-change'
```

### `SessionViewApplyOptions`

Current fields:

```ts
{
  transient?: boolean;
  transformPlan?: ContinuumTransformPlan;
}
```

### `ActionResult`

Current shape:

```ts
{
  success: boolean;
  data?: unknown;
  error?: unknown;
}
```

### `SessionPersistenceOptions.onError.reason`

Exact values:

```ts
'size_limit' | 'storage_error'
```

## License

MIT
