import type {
  ContinuitySnapshot,
  Interaction,
  PendingAction,
  Checkpoint,
  SchemaSnapshot,
  StateSnapshot,
  ComponentState,
  ValueMeta,
} from '@continuum/contract';
import { reconcile } from '@continuum/runtime';
import type { ReconciliationIssue, ReconciliationTrace, StateDiff } from '@continuum/runtime';
import type { Session, SessionOptions, SessionFactory } from './types.js';

interface SessionState {
  sessionId: string;
  clock: () => number;
  currentSchema: SchemaSnapshot | null;
  currentState: StateSnapshot | null;
  priorSchema: SchemaSnapshot | null;
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  trace: ReconciliationTrace[];
  eventLog: Interaction[];
  pendingActions: PendingAction[];
  snapshotListeners: Set<(snapshot: ContinuitySnapshot) => void>;
  issueListeners: Set<(issues: ReconciliationIssue[]) => void>;
  destroyed: boolean;
}

function generateId(prefix: string, clock: () => number): string {
  return `${prefix}_${clock()}_${Math.random().toString(36).substring(2, 9)}`;
}

function buildSession(internal: SessionState): Session {
  function notifySnapshotListeners() {
    const snapshot = getSnapshotInternal();
    if (!snapshot) return;
    for (const listener of internal.snapshotListeners) {
      listener(snapshot);
    }
  }

  function notifyIssueListeners() {
    for (const listener of internal.issueListeners) {
      listener([...internal.issues]);
    }
  }

  function getSnapshotInternal(): ContinuitySnapshot | null {
    if (!internal.currentSchema || !internal.currentState) return null;
    return { schema: internal.currentSchema, state: internal.currentState };
  }

  const session: Session = {
    get sessionId() {
      return internal.sessionId;
    },

    getSnapshot() {
      return getSnapshotInternal();
    },

    getIssues() {
      return [...internal.issues];
    },

    getDiffs() {
      return [...internal.diffs];
    },

    getTrace() {
      return [...internal.trace];
    },

    pushSchema(schema: SchemaSnapshot) {
      if (internal.destroyed) return;

      const priorVersion = internal.currentSchema?.version;
      internal.priorSchema = internal.currentSchema;
      internal.currentSchema = schema;

      const result = reconcile(
        schema,
        internal.priorSchema,
        internal.currentState,
        { clock: internal.clock }
      );

      internal.currentState = {
        ...result.reconciledState,
        meta: {
          ...result.reconciledState.meta,
          sessionId: internal.sessionId,
        },
      };
      internal.issues = result.issues;
      internal.diffs = result.diffs;
      internal.trace = result.trace;

      if (priorVersion && priorVersion !== schema.version) {
        for (const action of internal.pendingActions) {
          if (action.status === 'pending') {
            action.status = 'stale';
          }
        }
      }

      notifySnapshotListeners();
      notifyIssueListeners();
    },

    recordIntent(
      partial: Omit<Interaction, 'id' | 'timestamp' | 'sessionId' | 'schemaVersion'>
    ) {
      if (internal.destroyed || !internal.currentState || !internal.currentSchema) return;

      const now = internal.clock();
      const id = generateId('int', internal.clock);

      const interaction: Interaction = {
        id,
        sessionId: internal.sessionId,
        schemaVersion: internal.currentSchema.version,
        timestamp: now,
        componentId: partial.componentId,
        type: partial.type,
        payload: partial.payload,
      };

      internal.eventLog.push(interaction);

      internal.currentState = {
        ...internal.currentState,
        values: {
          ...internal.currentState.values,
          [partial.componentId]: partial.payload as ComponentState,
        },
        meta: {
          ...internal.currentState.meta,
          timestamp: now,
          lastInteractionId: id,
        },
        valuesMeta: {
          ...internal.currentState.valuesMeta,
          [partial.componentId]: {
            lastUpdated: now,
            lastInteractionId: id,
          } as ValueMeta,
        },
      };

      notifySnapshotListeners();
    },

    updateState(componentId: string, payload: unknown) {
      session.recordIntent({ componentId, type: 'state-update', payload });
    },

    getEventLog() {
      return [...internal.eventLog];
    },

    submitAction(
      partial: Omit<PendingAction, 'id' | 'createdAt' | 'status' | 'schemaVersion'>
    ) {
      if (internal.destroyed || !internal.currentSchema) return;

      const action: PendingAction = {
        id: generateId('action', internal.clock),
        componentId: partial.componentId,
        actionType: partial.actionType,
        payload: partial.payload,
        createdAt: internal.clock(),
        schemaVersion: internal.currentSchema.version,
        status: 'pending',
      };

      internal.pendingActions.push(action);
    },

    getPendingActions() {
      return [...internal.pendingActions];
    },

    validateAction(actionId: string) {
      const action = internal.pendingActions.find((a) => a.id === actionId);
      if (action) action.status = 'validated';
    },

    cancelAction(actionId: string) {
      const action = internal.pendingActions.find((a) => a.id === actionId);
      if (action) action.status = 'cancelled';
    },

    checkpoint(): Checkpoint {
      const snapshot = getSnapshotInternal()!;
      return {
        id: generateId('cp', internal.clock),
        sessionId: internal.sessionId,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
        eventIndex: internal.eventLog.length,
        timestamp: internal.clock(),
      };
    },

    restoreFromCheckpoint(cp: Checkpoint) {
      if (internal.destroyed) return;

      internal.currentSchema = cp.snapshot.schema;
      internal.currentState = cp.snapshot.state;
      internal.priorSchema = null;
      internal.eventLog = internal.eventLog.slice(0, cp.eventIndex);
      internal.issues = [];
      internal.diffs = [];
      internal.trace = [];
      internal.pendingActions = [];

      notifySnapshotListeners();
      notifyIssueListeners();
    },

    onSnapshot(listener: (snapshot: ContinuitySnapshot) => void) {
      internal.snapshotListeners.add(listener);
      return () => {
        internal.snapshotListeners.delete(listener);
      };
    },

    onIssues(listener: (issues: ReconciliationIssue[]) => void) {
      internal.issueListeners.add(listener);
      return () => {
        internal.issueListeners.delete(listener);
      };
    },

    serialize() {
      return {
        sessionId: internal.sessionId,
        currentSchema: internal.currentSchema,
        currentState: internal.currentState,
        priorSchema: internal.priorSchema,
        eventLog: internal.eventLog,
        pendingActions: internal.pendingActions,
        issues: internal.issues,
        diffs: internal.diffs,
        trace: internal.trace,
      };
    },

    destroy() {
      internal.destroyed = true;
      internal.currentSchema = null;
      internal.currentState = null;
      internal.priorSchema = null;
      internal.eventLog = [];
      internal.pendingActions = [];
      const result = { issues: [...internal.issues] };
      internal.issues = [];
      internal.snapshotListeners.clear();
      internal.issueListeners.clear();
      return result;
    },
  };

  return session;
}

export function createSession(options?: SessionOptions): Session {
  const clock = options?.clock ?? Date.now;
  const internal: SessionState = {
    sessionId: generateId('session', clock),
    clock,
    currentSchema: null,
    currentState: null,
    priorSchema: null,
    issues: [],
    diffs: [],
    trace: [],
    eventLog: [],
    pendingActions: [],
    snapshotListeners: new Set(),
    issueListeners: new Set(),
    destroyed: false,
  };
  return buildSession(internal);
}

export function deserialize(data: unknown, options?: SessionOptions): Session {
  const raw = data as {
    sessionId: string;
    currentSchema: SchemaSnapshot | null;
    currentState: StateSnapshot | null;
    priorSchema: SchemaSnapshot | null;
    eventLog: Interaction[];
    pendingActions: PendingAction[];
    issues: ReconciliationIssue[];
    diffs: StateDiff[];
    trace: ReconciliationTrace[];
  };

  const clock = options?.clock ?? Date.now;
  const internal: SessionState = {
    sessionId: raw.sessionId,
    clock,
    currentSchema: raw.currentSchema,
    currentState: raw.currentState,
    priorSchema: raw.priorSchema,
    issues: raw.issues ?? [],
    diffs: raw.diffs ?? [],
    trace: raw.trace ?? [],
    eventLog: raw.eventLog ?? [],
    pendingActions: raw.pendingActions ?? [],
    snapshotListeners: new Set(),
    issueListeners: new Set(),
    destroyed: false,
  };
  return buildSession(internal);
}

export const sessionFactory: SessionFactory = {
  createSession,
  deserialize,
};
