# ♾️ @continuum-dev/session

**The Stateful Ledger for Generative UI.** Give your AI agents memory, conflict resolution, and time-travel capabilities.

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

## Core Premise: The Ephemerality Gap

The Ephemerality Gap is the mismatch between ephemeral, regenerating interfaces and durable user intent.
Continuum keeps UI structure and user state separate, then uses deterministic reconciliation so user intent survives schema changes.

[![npm version](https://badge.fury.io/js/@continuum-dev%2Fsession.svg)](https://badge.fury.io/js/@continuum-dev%2Fsession)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem: The User and the AI are Fighting

Building a multi-turn Generative UI introduces a massive state management problem: **concurrency and conflict**.

- **Data Clobbering:** The user is typing in a text field, but the AI suddenly pushes an updated view and tries to overwrite their in-progress input.
- **Hallucinations:** The AI generates a broken layout or removes critical UI. You need deterministic undo.
- **Persistence:** A user closes the tab and returns later. You need exact rehydration of generated view, user state, and timeline.

Standard state managers are optimized for deterministic single-author UIs. They struggle when the UI schema itself mutates over time.

## The Solution

**Continuum Session** is a stateful lifecycle manager built on top of `@continuum-dev/runtime`. It converts a stream of AI view mutations and user interactions into a structured, event-sourced session ledger.

It tracks event history, manages checkpoints, protects dirty user input with proposals, and serializes durable session state into a portable blob for resumable experiences.

Streaming guide: [STREAMING.md](./STREAMING.md)

Upgrade references:

- [Root upgrade guide](../../docs/UPGRADING_FROM_0.3.x_TO_NEXT.md)
- [API delta](../../docs/API_DELTA_0.3.x_TO_NEXT.md)

```bash
npm install @continuum-dev/session
```

## Core Capabilities

- ⏱️ **Time-Travel (Undo/Rewind):** Auto-checkpoints on `pushView()`, plus manual checkpoints and rewind support.
- 🛡️ **Conflict Resolution (Proposals):** Dirty values are protected from AI overwrites by staging proposed values.
- 💾 **Portable Persistence:** `serialize()` and `deserialize()` capture and restore full session state.
- ⚡ **Action Registry:** Register and dispatch typed action handlers by intent id.
- 📖 **Event-Sourced Timeline:** Interactions, intents, checkpoint boundaries, and reconciliation diagnostics are preserved.

---

## Quick Start

```typescript
import { createSession } from '@continuum-dev/session';

const session = createSession();

session.pushView({
  viewId: 'agent-form',
  version: '1.0',
  nodes: [{ id: 'field_1', key: 'username', type: 'field' }],
});

session.updateState('field_1', { value: 'Alice' });

const snapshot = session.getSnapshot();
console.log(snapshot?.data.values['field_1'].value); // 'Alice'
```

---

## Public API Reference

The package exports:

- `./lib/session.js`
- `./lib/types.js`

### 1) Initialization and Lifecycle

#### `createSession(options?)`

Creates a fresh session ledger.

```typescript
function createSession(options?: SessionOptions): Session;
```

#### `deserialize(data, options?)`

Restores a previously serialized session blob.

```typescript
function deserialize(data: unknown, options?: SessionOptions): Session;
```

#### `hydrateOrCreate(options?)`

Creates from persisted storage when available, otherwise creates a new session.

```typescript
function hydrateOrCreate(options?: SessionOptions): Session;
```

Persistence note:

- When `options.persistence` is provided, snapshot writes are debounced by 200ms.
- Pending writes are flushed on `beforeunload` so tab closes do not drop recent updates.
- `SessionPersistenceOptions.maxBytes` enforces a payload size cap before writes.
- `SessionPersistenceOptions.onError` receives `size_limit` and `storage_error` events.
- Browser `storage` events are consumed for cross-tab session synchronization.

#### `sessionFactory`

DI-friendly factory object for session creation and deserialization.

```typescript
const sessionFactory: SessionFactory = { createSession, deserialize };
```

#### Subscriptions

Listen to state and issue updates.

```typescript
const stopSnapshot = session.onSnapshot((snapshot) => {
  // update UI
});

const stopStreams = session.onStreams((streams) => {
  // inspect open/committed/aborted stream metadata
});

const stopIssues = session.onIssues((issues) => {
  // handle warnings/errors
});
```

Snapshot listeners receive immutable top-level copies of `view` and `data`.

`session.getSnapshot()` now returns the current renderable snapshot, which can include an active foreground stream. Use `session.getCommittedSnapshot()` when you need the last durable `{ view, data }` pair that has actually been committed.

### 2) View and State Updates

#### `session.pushView(view)`

Pushes a new AI-generated view, runs reconciliation, updates detached values, marks stale pending intents on version change, and creates an auto-checkpoint.

```typescript
session.pushView({ viewId: 'form', version: '2.0', nodes: [] });
```

#### `session.updateState(nodeId, payload)`

Records a data update interaction for a node.

```typescript
session.updateState('email', { value: 'test@example.com', isDirty: true });
```

#### `session.recordIntent(interaction)`

Records a raw interaction event.

```typescript
session.recordIntent({
  nodeId: 'email',
  type: 'data-update',
  payload: { value: 'test@example.com' },
});
```

`recordIntent` clones incoming payload objects before storing them and deduplicates issues by `nodeId + code`.

#### Focus APIs

Focus is **not** part of `DataSnapshot`. It tracks which canonical node id is focused for UI orchestration (for example restoring focus after streamed view updates). After pushed or streamed view changes, focus is revalidated against the active render tree and clears if the node no longer resolves uniquely. Focus is not serialized. Scroll, zoom, and other layout state belong in local or app-level state, not the continuity snapshot.

```typescript
session.setFocusedNodeId('table_1');
const id = session.getFocusedNodeId();

session.onFocusChange((focusedNodeId) => {
  // focusedNodeId is string | null
});
```

#### Streaming APIs

Use streaming when you want the session to render partial AI updates before the full response has finished.

```typescript
const stream = session.beginStream({
  targetViewId: 'loan-intake',
  source: 'ai',
  mode: 'foreground',
  baseViewVersion: session.getCommittedSnapshot()?.view.version ?? null,
});

session.applyStreamPart(stream.streamId, {
  kind: 'patch',
  patch: {
    viewId: 'loan-intake',
    version: '2.0',
    operations: [
      {
        op: 'insert-node',
        parentId: 'loan_group',
        node: {
          id: 'borrower_email',
          type: 'field',
          dataType: 'string',
        },
      },
    ],
  },
});

session.applyStreamPart(stream.streamId, {
  kind: 'status',
  status: 'Building borrower section',
  level: 'info',
});

const result = session.commitStream(stream.streamId);
```

Core rules:

- Only one live stream may target a given `targetViewId` unless you explicitly supersede it.
- Only one foreground stream drives `getSnapshot()` at a time. Draft streams stay out of the render snapshot.
- Richer normalized parts such as `insert-node`, `replace-node`, `remove-node`, `append-content`, and `node-status` are supported in addition to `view`, `patch`, `state`, and `status`.
- Local input stays sacred. If a user types into a streamed node before commit, that value lives in the stream draft and wins over later AI updates.
- AI `state` parts never clobber protected values. Dirty and sticky committed values become proposals instead.
- Stream metadata is ephemeral. `serialize()`, checkpoints, and `getCommittedSnapshot()` stay durable-only.

There are two supported ingestion paths:

- Structured transport parts, such as Vercel AI SDK `data-continuum-view`, `data-continuum-patch`, `data-continuum-state`, and `data-continuum-status`
- Post-processed model text, where you parse DSL, YAML, JSON, or repaired text outside core and then normalize it into `SessionStreamPart`

### 3) Anti-Clobbering with Proposals

When a node has dirty user state and AI proposes a new value, Continuum stages the proposal instead of overwriting immediately.

#### `session.proposeValue(nodeId, value, source?)`

```typescript
session.proposeValue('email', { value: 'ai_guess@example.com' }, 'ai-agent');
```

#### `session.getPendingProposals()`

```typescript
const proposals = session.getPendingProposals();
```

#### `session.acceptProposal(nodeId)` / `session.rejectProposal(nodeId)`

```typescript
session.acceptProposal('email');
session.rejectProposal('email');
```

### 4) Time Travel with Checkpoints

#### `session.checkpoint()`

Manually captures a checkpoint snapshot.

```typescript
const cp = session.checkpoint();
```

#### `session.rewind(checkpointId)`

Rewinds to a checkpoint id and truncates checkpoint history after that point.

```typescript
session.rewind(cp.checkpointId);
```

#### `session.restoreFromCheckpoint(checkpoint)`

Restores to a checkpoint object without truncating the checkpoint stack.

```typescript
session.restoreFromCheckpoint(cp);
```

#### `session.getCheckpoints()`

```typescript
const checkpoints = session.getCheckpoints();
```

### 5) Intents and Event Sourcing

#### `session.submitIntent(intent)`

Queue a pending user intent for AI/backend processing.

```typescript
session.submitIntent({
  nodeId: 'submit_btn',
  intentName: 'execute_search',
  payload: { term: 'Continuum' },
});
```

#### `session.getPendingIntents()`, `session.validateIntent(intentId)`, `session.cancelIntent(intentId)`

```typescript
const intents = session.getPendingIntents();
session.validateIntent(intents[0].intentId);
session.cancelIntent(intents[0].intentId);
```

#### `session.getEventLog()`

```typescript
const log = session.getEventLog();
```

### 6) Actions Registry

Register handlers for semantic intent ids and dispatch them with full session context.

#### `session.registerAction(intentId, registration, handler)`

```typescript
session.registerAction('submit_form', { label: 'Submit' }, async (context) => {
  const response = await fetch('/api/submit', {
    method: 'POST',
    body: JSON.stringify(context.snapshot.values),
  });
  const data = await response.json();
  context.session.updateState('status', { value: 'submitted' });
  return { success: true, data };
});
```

Handlers receive an `ActionContext` with:

- `intentId` -- the dispatched intent identifier
- `snapshot` -- current `DataSnapshot` at dispatch time
- `nodeId` -- the node that triggered the action
- `session` -- an `ActionSessionRef` for post-action mutations (`pushView`, `updateState`, `getSnapshot`, `proposeValue`)

#### `session.dispatchAction(intentId, nodeId)`

Returns a `Promise<ActionResult>`. Catches handler errors automatically.

```typescript
const result = await session.dispatchAction('submit_form', 'btn_submit');
if (result.success) {
  console.log('Submitted:', result.data);
} else {
  console.error('Failed:', result.error);
}
```

If no handler is registered, a warning is logged and `{ success: false }` is returned.

#### `session.executeIntent(intent)`

Bridges the intent lifecycle and action dispatch in a single call: submits a pending intent, dispatches the registered action, and marks the intent as validated on success or cancelled on failure.

```typescript
const result = await session.executeIntent({
  nodeId: 'btn_submit',
  intentName: 'submit_form',
  payload: { source: 'user' },
});
```

Also available:

- `session.unregisterAction(intentId)`
- `session.getRegisteredActions()`

### 7) Teardown, Persistence, and Maintenance

```typescript
const blob = session.serialize();
const detached = session.getDetachedValues();
session.purgeDetachedValues();

session.reset();
const final = session.destroy();
```

Persistence behavior:

- `serialize()` returns a JSON-safe payload with `formatVersion: 1`.
- Automatic persistence writes are debounced (200ms) to reduce storage churn.
- Pending writes are flushed on `beforeunload` to reduce data loss risk during tab close.
- If `maxBytes` is exceeded, the write is skipped and `onError` is invoked.
- Remote storage updates can rehydrate in-memory state for cross-tab continuity.

`destroy()` returns:

```typescript
{ issues: ReconciliationIssue[] }
```

### 8) Core Types

Primary exported types from `src/lib/types.ts`:

- `Session`
- `SessionOptions`
- `SessionFactory`
- `SessionPersistenceOptions`
- `SessionPersistenceStorage`

---

## Architecture Context

`@continuum-dev/session` handles stateful timeline management and lifecycle orchestration. It delegates structural data reconciliation to `@continuum-dev/runtime` whenever a new view is pushed.

Framework bindings can wrap this package for UI-first usage:

- `@continuum-dev/react`
- `@continuum-dev/angular`

## License

MIT © Bryton Cooper
