# Session Internals

These modules are internal to `@continuum/session`. They are imported only by the top-level `session.ts` orchestrator and are not re-exported through the package's public API.

## Data Flow

```
session.ts (orchestrator)
  createSession  -->  session-state.createEmptySessionState + assembleSessionFromInternalState
  deserialize    -->  serializer.deserializeToState + assembleSessionFromInternalState

  assembleSessionFromInternalState wires the Session interface:
    pushSchema:
      schema-pusher.pushSchema
        reconcile(...)                      @continuum/runtime
        action-manager.markAllPendingActionsAsStale  mark stale on version change
        checkpoint-manager.autoCheckpoint   snapshot after each push
        listeners.notifySnapshotAndIssueListeners        broadcast to subscribers
    recordIntent / updateState:
      event-log.recordIntent              update state + event log
      listeners.notifySnapshotListeners   broadcast state change
    submitAction / validateAction / cancelAction:
      action-manager.*
    checkpoint / rewind / restoreFromCheckpoint:
      checkpoint-manager.*
      listeners.notifySnapshotAndIssueListeners
    onSnapshot / onIssues:
      listeners.subscribeSnapshot / subscribeIssues
    serialize:
      serializer.serializeSession
    destroy:
      destroyer.teardownSessionAndClearState
```

## Modules

| File | Responsibility |
|---|---|
| `session-state.ts` | `SessionState` interface, `createEmptySessionState` factory, `generateId` utility. |
| `listeners.ts` | Snapshot and issue listener notification, subscription helpers. `buildSnapshotFromCurrentState` builds the current `ContinuitySnapshot`. |
| `schema-pusher.ts` | `pushSchema` -- runs reconciliation, stales actions, auto-checkpoints, and notifies listeners. |
| `checkpoint-manager.ts` | Auto-checkpoint on schema push, manual checkpoint, restore, and rewind with stack trimming. |
| `action-manager.ts` | Pending action lifecycle: submit, validate, cancel, and stale-on-version-change. |
| `event-log.ts` | `recordIntent` -- logs interactions and updates component state + valuesMeta. |
| `serializer.ts` | `serializeSession` and `deserializeToState` with format version validation. |
| `destroyer.ts` | `teardownSessionAndClearState` -- tears down internal state and clears listeners. |
