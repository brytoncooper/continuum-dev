# @continuum/session

Session lifecycle manager for the Continuum SDK.

Orchestrates view pushes, state updates, checkpointing, rewind, serialization, and event logging. Built on top of `@continuum/runtime` for reconciliation.

## Installation

```bash
npm install @continuum/session
```

## Quick Start

```typescript
import { createSession, deserialize } from '@continuum/session';
import type {
  ViewDefinition,
  Interaction,
  ContinuitySnapshot,
  PendingIntent,
  Checkpoint,
  DetachedValue,
} from '@continuum/contract';
import type { ReconciliationOptions, ReconciliationIssue, StateDiff, ReconciliationResolution } from '@continuum/runtime';

const session = createSession();

session.pushView({
  viewId: 'my-form',
  version: '1.0',
  nodes: [
    { id: 'name', type: 'field', dataType: 'string', key: 'name' },
    { id: 'agree', type: 'field', dataType: 'boolean', key: 'agree' },
  ],
});

session.updateState('name', { value: 'Alice' });

const snapshot: ContinuitySnapshot | null = session.getSnapshot();

const blob = session.serialize();

const restored = deserialize(blob);
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

Throws if `data.formatVersion` is present and not supported.

### `sessionFactory`

An object containing both factory functions, useful for dependency injection.

```typescript
const sessionFactory: SessionFactory = { createSession, deserialize };
```

## SessionOptions

```ts
interface SessionOptions {
  clock?: () => number;           // custom clock for timestamps (default: Date.now)
  maxEventLogSize?: number;        // cap and trim oldest interactions
  maxPendingIntents?: number;      // cap and trim oldest pending intents
  maxCheckpoints?: number;         // cap checkpoints (auto checkpoints may be pruned first)
  reconciliation?: Omit<ReconciliationOptions, 'clock'>;
  validateOnUpdate?: boolean;
}
```

## Session Interface

### Reading State

| Method | Returns | Description |
|---|---|---|
| `sessionId` | `string` | Unique identifier for this session (readonly) |
| `getSnapshot()` | `ContinuitySnapshot \| null` | Current combined view + data |
| `getIssues()` | `ReconciliationIssue[]` | Issues from the last reconciliation |
| `getDiffs()` | `StateDiff[]` | Diffs from the last reconciliation |
| `getResolutions()` | `ReconciliationResolution[]` | Resolutions from the last reconciliation |
| `getEventLog()` | `Interaction[]` | Full interaction history |
| `getPendingIntents()` | `PendingIntent[]` | Pending intent list |
| `getDetachedValues()` | `Record<string, DetachedValue>` | Detached values from prior incompatible nodes |
| `getCheckpoints()` | `Checkpoint[]` | Current checkpoint stack |

### View and State Management

| Method | Signature | Description |
|---|---|---|
| `pushView(view)` | `(view: ViewDefinition) => void` | Push a new view version. Triggers reconciliation, auto-checkpoints, stale pending intents on version change, and notifies listeners. |
| `recordIntent(interaction)` | `(interaction: Omit<Interaction, 'interactionId' \| 'timestamp' \| 'sessionId' \| 'viewVersion'>) => void` | Record a raw interaction event. |
| `updateState(nodeId, payload)` | `(nodeId: string, payload: unknown) => void` | Update node value directly. Records an interaction and updates lineage. |

### Pending Intents

| Method | Signature | Description |
|---|---|---|
| `submitIntent(intent)` | `(intent: Omit<PendingIntent, 'intentId' \| 'queuedAt' \| 'status' \| 'viewVersion'>) => void` | Submit a new pending intent |
| `validateIntent(intentId)` | `(intentId: string) => boolean` | Mark an intent as validated, returns whether it existed |
| `cancelIntent(intentId)` | `(intentId: string) => boolean` | Mark an intent as cancelled, returns whether it existed |

### Checkpoints and Rewind

| Method | Signature | Description |
|---|---|---|
| `checkpoint()` | `() => Checkpoint` | Manually create a checkpoint |
| `restoreFromCheckpoint(checkpoint)` | `(checkpoint: Checkpoint) => void` | Restore session to a specific checkpoint |
| `rewind(checkpointId)` | `(checkpointId: string) => void` | Rewind to a checkpoint by ID and trim stack to that point |

### Lifecycle

| Method | Signature | Description |
|---|---|---|
| `reset()` | `() => void` | Clear active state while keeping session id and options |
| `onSnapshot(listener)` | `(listener: (snapshot: ContinuitySnapshot) => void) => () => void` | Subscribe to snapshot changes. Returns an unsubscribe function. |
| `onIssues(listener)` | `(listener: (issues: ReconciliationIssue[]) => void) => () => void` | Subscribe to issue changes. Returns an unsubscribe function. |
| `serialize()` | `() => unknown` | Serialize the full session to a JSON-compatible blob (`{ formatVersion: 1, ... }`) |
| `destroy()` | `() => { issues: ReconciliationIssue[] }` | Teardown the session and return the final issue snapshot. |

## Links

- [Root README](../../README.md)
- [Quick Start Guide](../../docs/QUICK_START.md)
