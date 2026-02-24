# @continuum/session

Session lifecycle manager for the Continuum SDK.

Orchestrates schema pushes, state updates, checkpointing, rewind, serialization, and event logging. Built on top of `@continuum/runtime` for reconciliation.

## Installation

```bash
npm install @continuum/session
```

## Quick Start

```typescript
import { createSession, deserialize } from '@continuum/session';

const session = createSession();

session.pushSchema({
  schemaId: 'my-form',
  version: '1.0',
  components: [
    { id: 'name', type: 'input', key: 'name' },
    { id: 'agree', type: 'toggle', key: 'agree' },
  ],
});

session.updateState('name', { value: 'Alice' });

const snapshot = session.getSnapshot();
// { schema: SchemaSnapshot, state: StateSnapshot }

const blob = session.serialize();
// persist to storage...

const restored = deserialize(blob);
// restored session with full state
```

## Factory Functions

### `createSession(options?)`

Creates a new empty session.

```typescript
function createSession(options?: SessionOptions): Session;
```

### `deserialize(data, options?)`

Reconstructs a session from a serialized blob (produced by `session.serialize()`).

```typescript
function deserialize(data: unknown, options?: SessionOptions): Session;
```

Throws if `data.formatVersion` exceeds the supported version.

### `sessionFactory`

An object containing both factory functions, useful for dependency injection.

```typescript
const sessionFactory: SessionFactory = { createSession, deserialize };
```

## SessionOptions

```typescript
interface SessionOptions {
  clock?: () => number;   // custom clock for timestamps (default: Date.now)
}
```

## Session Interface

### Reading State

| Method | Returns | Description |
|---|---|---|
| `sessionId` | `string` | Unique identifier for this session (readonly) |
| `getSnapshot()` | `ContinuitySnapshot \| null` | Current combined schema + state |
| `getIssues()` | `ReconciliationIssue[]` | Issues from the last reconciliation |
| `getDiffs()` | `StateDiff[]` | Diffs from the last reconciliation |
| `getTrace()` | `ReconciliationTrace[]` | Trace from the last reconciliation |
| `getEventLog()` | `Interaction[]` | Full interaction history |

### Schema Management

| Method | Signature | Description |
|---|---|---|
| `pushSchema(schema)` | `(schema: SchemaSnapshot) => void` | Push a new schema version. Triggers reconciliation, auto-checkpoints, stales pending actions if version changed, and notifies listeners. |

### User Interaction

| Method | Signature | Description |
|---|---|---|
| `updateState(componentId, payload)` | `(componentId: string, payload: unknown) => void` | Update a component's state. Records an interaction and notifies listeners. |
| `recordIntent(interaction)` | `(interaction: Omit<Interaction, 'id' \| 'timestamp' \| 'sessionId' \| 'schemaVersion'>) => void` | Record a raw interaction event with custom type and payload. |

### Pending Actions

| Method | Signature | Description |
|---|---|---|
| `submitAction(action)` | `(action: Omit<PendingAction, 'id' \| 'createdAt' \| 'status' \| 'schemaVersion'>) => void` | Submit a new pending action |
| `getPendingActions()` | `() => PendingAction[]` | Get all pending actions |
| `validateAction(actionId)` | `(actionId: string) => void` | Mark an action as validated |
| `cancelAction(actionId)` | `(actionId: string) => void` | Mark an action as cancelled |

### Checkpoints and Rewind

| Method | Signature | Description |
|---|---|---|
| `checkpoint()` | `() => Checkpoint` | Manually create a checkpoint |
| `restoreFromCheckpoint(checkpoint)` | `(checkpoint: Checkpoint) => void` | Restore session to a specific checkpoint |
| `getCheckpoints()` | `() => Checkpoint[]` | Get the checkpoint stack |
| `rewind(checkpointId)` | `(checkpointId: string) => void` | Rewind to a checkpoint by ID. Trims the stack to the rewound point. |

### Persistence

| Method | Signature | Description |
|---|---|---|
| `serialize()` | `() => unknown` | Serialize the full session to a JSON-compatible blob (`{ formatVersion: 1, ... }`) |

### Listeners

| Method | Signature | Description |
|---|---|---|
| `onSnapshot(listener)` | `(listener: (snapshot: ContinuitySnapshot) => void) => () => void` | Subscribe to snapshot changes. Returns an unsubscribe function. |
| `onIssues(listener)` | `(listener: (issues: ReconciliationIssue[]) => void) => () => void` | Subscribe to issue changes. Returns an unsubscribe function. |

### Lifecycle

| Method | Signature | Description |
|---|---|---|
| `destroy()` | `() => { issues: ReconciliationIssue[] }` | Tear down the session. Returns final issues. Subsequent calls are no-ops. |

## Links

- [Root README](../../README.md)
- [Quick Start Guide](../../docs/QUICK_START.md)
