# ♾️ @continuum-dev/session

**The Stateful Ledger for Generative UI.** Give your AI agents memory, conflict resolution, and time-travel capabilities.

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

It tracks event history, manages checkpoints, protects dirty user input with proposals, and serializes the entire session into a portable blob for resumable experiences.

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
  nodes: [{ id: 'field_1', key: 'username', type: 'field' }]
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

const stopIssues = session.onIssues((issues) => {
  // handle warnings/errors
});
```

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
  payload: { value: 'test@example.com' }
});
```

#### Viewport APIs

```typescript
session.updateViewportState('table_1', { scrollY: 320, isFocused: true });
const viewport = session.getViewportState('table_1');
```

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
  payload: { term: 'Continuum' }
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
