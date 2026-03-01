# Continuum Architecture

## Package Dependency & Structure

```mermaid
graph TB
    subgraph contractPkg ["@continuum/contract — Data Shapes"]
        ViewDefinition["ViewDefinition\n(viewId, version, nodes)"]
        ViewNode["ViewNode\n(discriminated union: Field | Group | Collection | Action | Presentation)"]
        DataSnapshot["DataSnapshot\n(values, lineage, valueLineage, detachedValues)"]
        NodeValue["NodeValue&lt;T&gt;\n({ value: T, isDirty?, isValid? })"]
        ContinuitySnapshot["ContinuitySnapshot\n= view + data"]
        Interaction["Interaction\n(interactionId, nodeId, type, payload, viewVersion)"]
        PendingIntent["PendingIntent\n(intentId, nodeId, intentName, queuedAt, viewVersion, status)"]
        Checkpoint["Checkpoint\n(checkpointId, sessionId, snapshot, eventIndex, trigger)"]
        MigrationRule["MigrationRule\n(fromHash, toHash, strategyId)"]

        ViewDefinition --> ViewNode
        ViewNode --> MigrationRule
        DataSnapshot --> NodeValue
        ContinuitySnapshot --> ViewDefinition
        ContinuitySnapshot --> DataSnapshot
        Checkpoint --> ContinuitySnapshot
    end

    subgraph runtimePkg ["@continuum/runtime — Reconciliation Engine"]
        reconcile["reconcile(newView, priorView, priorData, options)"]
        buildCtx["buildReconciliationContext\n(index nodes by id and key)"]
        findPrior["findPriorNode\n(match by id, then by key)"]
        attemptMigration["attemptMigration\n(strategy lookup or identity fallback)"]
        ReconciliationResult["ReconciliationResult\n(reconciledState, diffs, issues, resolutions)"]

        reconcile --> buildCtx
        reconcile --> findPrior
        reconcile --> attemptMigration
        reconcile --> ReconciliationResult
    end

    subgraph sessionPkg ["@continuum/session — Stateful Session Manager"]
        createSession["createSession(options?)"]
        SessionObj["Session"]
        pushView["pushView(view)"]
        recordIntent["recordIntent(partial)\nupdateState(nodeId, payload)"]
        intentOps["submitIntent / validateIntent / cancelIntent"]
        checkpointOps["checkpoint() / restoreFromCheckpoint() / rewind()"]
        serializeOps["serialize() / deserialize()"]
        listeners["onSnapshot(listener)\nonIssues(listener)"]
        destroy["destroy()"]

        createSession --> SessionObj
        SessionObj --> pushView
        SessionObj --> recordIntent
        SessionObj --> intentOps
        SessionObj --> checkpointOps
        SessionObj --> serializeOps
        SessionObj --> listeners
        SessionObj --> destroy
    end

    pushView -->|"calls"| reconcile
    reconcile -->|"reads"| ViewDefinition
    reconcile -->|"reads"| DataSnapshot
    reconcile -->|"returns"| ReconciliationResult
    ReconciliationResult -->|"updates"| SessionObj

    recordIntent -->|"appends"| Interaction
    recordIntent -->|"mutates"| DataSnapshot
    intentOps -->|"manages"| PendingIntent
    checkpointOps -->|"saves/restores"| Checkpoint
```

## Session Lifecycle Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant S as Session
    participant R as Runtime (reconcile)
    participant State as Internal State

    App->>S: createSession(options?)
    Note over S: sessionId generated, snapshot = null

    App->>S: pushView(viewV1)
    S->>R: reconcile(viewV1, null, null, options)
    R-->>S: reconciledState (empty), issues: [NO_PRIOR_DATA]
    S->>State: currentView = viewV1, currentData = empty
    Note over S: Notifies snapshot + issue listeners

    App->>S: recordIntent({ nodeId, type, payload })
    S->>State: Merge payload into values[nodeId]
    S->>State: Update lineage + valueLineage timestamps
    S->>State: Append Interaction to eventLog
    Note over S: Notifies snapshot listeners

    App->>S: submitIntent({ nodeId, intentName, payload })
    S->>State: Add PendingIntent (status: pending)

    App->>S: checkpoint()
    S-->>App: Checkpoint (deep-cloned snapshot + eventIndex)

    App->>S: pushView(viewV2)
    S->>R: reconcile(viewV2, viewV1, currentData, options)
    R->>R: Build context (index nodes by id + key)
    R->>R: For each new node: findPriorNode, carry or migrate value
    R->>R: Detect added/removed/migrated nodes
    R-->>S: reconciledState + diffs + issues + resolutions
    S->>State: currentData = reconciledState
    S->>State: Mark pending intents as stale (view version changed)
    Note over S: Notifies snapshot + issue listeners

    App->>S: restoreFromCheckpoint(cp)
    S->>State: Restore view + data from checkpoint
    S->>State: Truncate eventLog to cp.eventIndex

    App->>S: serialize()
    S-->>App: { formatVersion: 1, currentView, currentData, priorView, resolutions, pendingIntents, ... }
    App->>S: deserialize(blob)
    Note over S: Reconstructed session with fresh listeners
```

## Summary

- **Contract** is the pure type layer. It defines the shapes for view definitions (node trees with migration rules), data snapshots (per-node values + lineage), continuity snapshots (view + data paired), interactions (event log entries), pending intents (uncommitted mutations with lifecycle), and checkpoints (restore points with a trigger of `'auto'` or `'manual'`).

- **Runtime** is the stateless reconciliation engine. Its single entry point, `reconcile`, takes a new view, an optional prior view, and optional prior data, then figures out which node values to carry forward, which need migration (via hash comparison and strategy lookup), and which are new or removed. It returns a new `DataSnapshot` plus diffs, issues, and resolutions.

- **Session** is the stateful orchestrator. It owns a session ID, manages the current view and data, and exposes the full API: pushing views (which triggers reconciliation via the runtime), recording user intents (which mutate data and append to the event log), managing pending intents (`submitIntent` / `validateIntent` / `cancelIntent`), creating/restoring checkpoints, subscribing to snapshot and issue changes, retrieving resolutions (`getResolutions`), and serializing/deserializing the entire session for persistence.

The core cycle is: **push a view** (runtime reconciles data) -> **record intents** (data updates + event log) -> **push a new view version** (runtime reconciles again, migrating or carrying values, marking stale intents) -> **checkpoint/restore** as needed.
