# Continuum Architecture

## Package Dependency & Structure

```mermaid
graph TB
    subgraph contractPkg ["@continuum/contract — Data Shapes"]
        SchemaSnapshot["SchemaSnapshot\n(schemaId, version, components)"]
        ComponentDef["ComponentDefinition\n(id, type, key, hash, migrations, children)"]
        StateSnapshot["StateSnapshot\n(values, meta, valuesMeta)"]
        ComponentState["ComponentState\n(ValueInput | Toggle | Selection | Viewport | Record)"]
        ContinuitySnapshot["ContinuitySnapshot\n= schema + state"]
        Interaction["Interaction\n(componentId, type, payload)"]
        PendingAction["PendingAction\n(componentId, actionType, status)"]
        Checkpoint["Checkpoint\n(snapshot, eventIndex)"]
        MigrationRule["MigrationRule\n(fromHash, toHash, strategyId)"]

        SchemaSnapshot --> ComponentDef
        ComponentDef --> MigrationRule
        StateSnapshot --> ComponentState
        ContinuitySnapshot --> SchemaSnapshot
        ContinuitySnapshot --> StateSnapshot
        Checkpoint --> ContinuitySnapshot
    end

    subgraph runtimePkg ["@continuum/runtime — Reconciliation Engine"]
        reconcile["reconcile(newSchema, priorSchema, priorState, options)"]
        buildCtx["buildReconciliationContext\n(index components by id and key)"]
        findPrior["findPriorComponent\n(match by id, then by key)"]
        attemptMigration["attemptMigration\n(strategy lookup or identity fallback)"]
        ReconciliationResult["ReconciliationResult\n(reconciledState, diffs, issues)"]

        reconcile --> buildCtx
        reconcile --> findPrior
        reconcile --> attemptMigration
        reconcile --> ReconciliationResult
    end

    subgraph sessionPkg ["@continuum/session — Stateful Session Manager"]
        createSession["createSession(options?)"]
        SessionObj["Session"]
        pushSchema["pushSchema(schema)"]
        recordIntent["recordIntent(partial)\nupdateState(componentId, payload)"]
        pendingOps["submitAction / validateAction / cancelAction"]
        checkpointOps["checkpoint() / restoreFromCheckpoint()"]
        serializeOps["serialize() / deserialize()"]
        listeners["onSnapshot(listener)\nonIssues(listener)"]
        destroy["destroy()"]

        createSession --> SessionObj
        SessionObj --> pushSchema
        SessionObj --> recordIntent
        SessionObj --> pendingOps
        SessionObj --> checkpointOps
        SessionObj --> serializeOps
        SessionObj --> listeners
        SessionObj --> destroy
    end

    pushSchema -->|"calls"| reconcile
    reconcile -->|"reads"| SchemaSnapshot
    reconcile -->|"reads"| StateSnapshot
    reconcile -->|"returns"| ReconciliationResult
    ReconciliationResult -->|"updates"| SessionObj

    recordIntent -->|"appends"| Interaction
    recordIntent -->|"mutates"| StateSnapshot
    pendingOps -->|"manages"| PendingAction
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

    App->>S: pushSchema(schemaV1)
    S->>R: reconcile(schemaV1, null, null, options)
    R-->>S: reconciledState (empty), issues: [NO_PRIOR_STATE]
    S->>State: currentSchema = schemaV1, currentState = empty
    Note over S: Notifies snapshot + issue listeners

    App->>S: recordIntent({ componentId, type, payload })
    S->>State: Merge payload into values[componentId]
    S->>State: Update meta + valuesMeta timestamps
    S->>State: Append Interaction to eventLog
    Note over S: Notifies snapshot listeners

    App->>S: submitAction({ componentId, actionType, payload })
    S->>State: Add PendingAction (status: pending)

    App->>S: checkpoint()
    S-->>App: Checkpoint (deep-cloned snapshot + eventIndex)

    App->>S: pushSchema(schemaV2)
    S->>R: reconcile(schemaV2, schemaV1, currentState, options)
    R->>R: Build context (index by id + key)
    R->>R: For each new component: find prior, carry or migrate state
    R->>R: Detect added/removed/migrated components
    R-->>S: reconciledState + diffs + issues
    S->>State: currentState = reconciledState
    S->>State: Mark pending actions as stale (version changed)
    Note over S: Notifies snapshot + issue listeners

    App->>S: restoreFromCheckpoint(cp)
    S->>State: Restore schema + state from checkpoint
    S->>State: Truncate eventLog to cp.eventIndex

    App->>S: serialize()
    S-->>App: JSON-safe blob (schema, state, eventLog, pendingActions, issues)
    App->>S: deserialize(blob)
    Note over S: Reconstructed session with fresh listeners
```

## Summary

- **Contract** is the pure type layer -- it defines the shapes for schemas (component trees with migration rules), state (per-component values + metadata), snapshots (schema + state paired), interactions (event log entries), pending actions (uncommitted mutations with lifecycle), and checkpoints (restore points).

- **Runtime** is the stateless reconciliation engine. Its single entry point, `reconcile`, takes a new schema, an optional prior schema, and optional prior state, then figures out which component states to carry forward, which need migration (via hash comparison and strategy lookup), and which are new or removed. It returns a new `StateSnapshot` plus diffs and issues.

- **Session** is the stateful orchestrator. It owns a session ID, manages the current schema and state, and exposes the full API: pushing schemas (which triggers reconciliation via the runtime), recording user intents (which mutate state and append to the event log), managing pending actions, creating/restoring checkpoints, subscribing to snapshot and issue changes, and serializing/deserializing the entire session for persistence.

The core cycle is: **push a schema** (runtime reconciles state) -> **record intents** (state updates + event log) -> **push a new schema version** (runtime reconciles again, migrating or carrying state, marking stale actions) -> **checkpoint/restore** as needed.
