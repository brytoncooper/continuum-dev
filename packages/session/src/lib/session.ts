import { INTERACTION_TYPES } from '@continuum/contract';
import type { ViewportState, DetachedValue, NodeValue, ActionRegistration, ActionHandler } from '@continuum/contract';
import type { Session, SessionOptions, SessionFactory } from './types.js';
import { createEmptySessionState, generateId, resetSessionState } from './session/session-state.js';
import type { SessionState } from './session/session-state.js';
import { buildSnapshotFromCurrentState, notifySnapshotListeners, subscribeSnapshot, subscribeIssues } from './session/listeners.js';
import { cloneCheckpointSnapshot, createManualCheckpoint, restoreFromCheckpoint, rewind } from './session/checkpoint-manager.js';
import { submitIntent, validateIntent, cancelIntent } from './session/intent-manager.js';
import { recordIntent } from './session/event-log.js';
import { pushView } from './session/view-pusher.js';
import { serializeSession, deserializeToState } from './session/serializer.js';
import { teardownSessionAndClearState } from './session/destroyer.js';
import { attachPersistence } from './session/persistence.js';

const DEFAULT_STORAGE_KEY = 'continuum_session';
const SESSION_DESTROYED_ERROR = 'Session has been destroyed';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error(SESSION_DESTROYED_ERROR);
  }
}

function applyViewportStateUpdate(
  internal: SessionState,
  nodeId: string,
  state: ViewportState
): void {
  if (!internal.currentData) {
    return;
  }
  const now = internal.clock();
  internal.currentData = {
    ...internal.currentData,
    viewContext: {
      ...(internal.currentData.viewContext ?? {}),
      [nodeId]: state,
    },
    lineage: {
      ...internal.currentData.lineage,
      timestamp: now,
    },
  };

  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.trigger === 'auto');
  if (lastAutoCheckpoint) {
    const snapshot = buildSnapshotFromCurrentState(internal);
    if (snapshot) {
      lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
    }
  }

  notifySnapshotListeners(internal);
}

function assembleSessionFromInternalState(
  internal: SessionState,
  cleanupPersistence?: () => void
): Session {
  const session: Session = {
    get sessionId() { return internal.sessionId; },
    get isDestroyed() { return internal.destroyed; },
    getSnapshot() { assertNotDestroyed(internal); return buildSnapshotFromCurrentState(internal); },
    getIssues() { assertNotDestroyed(internal); return [...internal.issues]; },
    getDiffs() { assertNotDestroyed(internal); return [...internal.diffs]; },
    getResolutions() { assertNotDestroyed(internal); return [...internal.resolutions]; },
    getEventLog() { assertNotDestroyed(internal); return [...internal.eventLog]; },
    getPendingIntents() { assertNotDestroyed(internal); return [...internal.pendingIntents]; },
    getDetachedValues() {
      assertNotDestroyed(internal);
      return { ...(internal.currentData?.detachedValues ?? {}) };
    },
    purgeDetachedValues(filter?: (key: string, value: DetachedValue) => boolean) {
      assertNotDestroyed(internal);
      if (!internal.currentData?.detachedValues) return;
      if (!filter) {
        const { detachedValues: _, ...rest } = internal.currentData;
        internal.currentData = rest;
      } else {
        const remaining: Record<string, DetachedValue> = {};
        for (const [key, value] of Object.entries(internal.currentData.detachedValues)) {
          if (!filter(key, value)) {
            remaining[key] = value;
          }
        }
        if (Object.keys(remaining).length === 0) {
          const { detachedValues: _, ...rest } = internal.currentData;
          internal.currentData = rest;
        } else {
          internal.currentData = { ...internal.currentData, detachedValues: remaining };
        }
      }
      notifySnapshotListeners(internal);
    },
    proposeValue(nodeId: string, value: NodeValue, source?: string) {
      assertNotDestroyed(internal);
      if (!internal.currentData) return;
      const existing = internal.currentData.values[nodeId] as NodeValue | undefined;
      if (existing && existing.isDirty) {
        internal.pendingProposals[nodeId] = {
          nodeId,
          proposedValue: value,
          currentValue: existing,
          proposedAt: internal.clock(),
          source,
        };
        notifySnapshotListeners(internal);
      } else {
        recordIntent(internal, { nodeId, type: INTERACTION_TYPES.DATA_UPDATE, payload: value });
        delete internal.pendingProposals[nodeId];
      }
    },
    acceptProposal(nodeId: string) {
      assertNotDestroyed(internal);
      const proposal = internal.pendingProposals[nodeId];
      if (!proposal) return;
      recordIntent(internal, { 
        nodeId, 
        type: INTERACTION_TYPES.DATA_UPDATE, 
        payload: { ...proposal.proposedValue, isDirty: true } 
      });
      delete internal.pendingProposals[nodeId];
    },
    rejectProposal(nodeId: string) {
      assertNotDestroyed(internal);
      if (!internal.pendingProposals[nodeId]) {
        return;
      }
      delete internal.pendingProposals[nodeId];
      notifySnapshotListeners(internal);
    },
    getPendingProposals() {
      assertNotDestroyed(internal);
      return { ...internal.pendingProposals };
    },
    getCheckpoints() { assertNotDestroyed(internal); return [...internal.checkpoints]; },

    pushView(view) { assertNotDestroyed(internal); pushView(internal, view); },
    recordIntent(partial) { assertNotDestroyed(internal); recordIntent(internal, partial); },
    updateState(nodeId, payload) {
      assertNotDestroyed(internal);
      recordIntent(internal, { nodeId, type: INTERACTION_TYPES.DATA_UPDATE, payload });
    },
    getViewportState(nodeId) {
      assertNotDestroyed(internal);
      return internal.currentData?.viewContext?.[nodeId];
    },
    updateViewportState(nodeId, state) {
      assertNotDestroyed(internal);
      applyViewportStateUpdate(internal, nodeId, state);
    },

    submitIntent(partial) { assertNotDestroyed(internal); submitIntent(internal, partial); },
    validateIntent(intentId) { assertNotDestroyed(internal); return validateIntent(internal, intentId); },
    cancelIntent(intentId) { assertNotDestroyed(internal); return cancelIntent(internal, intentId); },

    checkpoint() { assertNotDestroyed(internal); return createManualCheckpoint(internal); },
    restoreFromCheckpoint(cp) { assertNotDestroyed(internal); restoreFromCheckpoint(internal, cp); },
    rewind(checkpointId) { assertNotDestroyed(internal); rewind(internal, checkpointId); },
    reset() {
      assertNotDestroyed(internal);
      resetSessionState(internal);
      notifySnapshotListeners(internal);
    },

    onSnapshot(listener) { assertNotDestroyed(internal); return subscribeSnapshot(internal, listener); },
    onIssues(listener) { assertNotDestroyed(internal); return subscribeIssues(internal, listener); },

    serialize() { assertNotDestroyed(internal); return serializeSession(internal); },
    destroy() {
      assertNotDestroyed(internal);
      cleanupPersistence?.();
      return teardownSessionAndClearState(internal);
    },
    registerAction(intentId: string, registration: ActionRegistration, handler: ActionHandler) {
      assertNotDestroyed(internal);
      internal.actionRegistry.set(intentId, { registration, handler });
    },
    unregisterAction(intentId: string) {
      assertNotDestroyed(internal);
      internal.actionRegistry.delete(intentId);
    },
    getRegisteredActions() {
      assertNotDestroyed(internal);
      const result: Record<string, ActionRegistration> = {};
      for (const [id, entry] of internal.actionRegistry) {
        result[id] = entry.registration;
      }
      return result;
    },
    dispatchAction(intentId: string, nodeId: string) {
      assertNotDestroyed(internal);
      const entry = internal.actionRegistry.get(intentId);
      if (!entry) return;
      const snapshot = buildSnapshotFromCurrentState(internal);
      if (!snapshot) return;
      return entry.handler({ intentId, snapshot: snapshot.data, nodeId });
    },
  };

  return session;
}

export function createSession(options?: SessionOptions): Session {
  const clock = options?.clock ?? Date.now;
  const internal = createEmptySessionState(generateId('session', clock), clock);
  internal.maxEventLogSize = options?.maxEventLogSize ?? internal.maxEventLogSize;
  internal.maxPendingIntents = options?.maxPendingIntents ?? internal.maxPendingIntents;
  internal.maxCheckpoints = options?.maxCheckpoints ?? internal.maxCheckpoints;
  internal.reconciliationOptions = options?.reconciliation;
  internal.validateOnUpdate = options?.validateOnUpdate ?? internal.validateOnUpdate;
  internal.detachedValuePolicy = options?.detachedValuePolicy;
  if (options?.actions) {
    for (const [id, entry] of Object.entries(options.actions)) {
      internal.actionRegistry.set(id, entry);
    }
  }
  const cleanupPersistence = options?.persistence
    ? attachPersistence(internal, {
      ...options.persistence,
      key: options.persistence.key ?? DEFAULT_STORAGE_KEY,
    })
    : undefined;
  return assembleSessionFromInternalState(internal, cleanupPersistence);
}

export function deserialize(data: unknown, options?: SessionOptions): Session {
  const internal = deserializeToState(
    data,
    options?.clock ?? Date.now,
    {
      maxEventLogSize: options?.maxEventLogSize,
      maxPendingIntents: options?.maxPendingIntents,
      maxCheckpoints: options?.maxCheckpoints,
    }
  );
  if (options?.reconciliation) {
    internal.reconciliationOptions = options.reconciliation;
  }
  if (options?.validateOnUpdate !== undefined) {
    internal.validateOnUpdate = options.validateOnUpdate;
  }
  const cleanupPersistence = options?.persistence
    ? attachPersistence(internal, {
      ...options.persistence,
      key: options.persistence.key ?? DEFAULT_STORAGE_KEY,
    })
    : undefined;
  return assembleSessionFromInternalState(internal, cleanupPersistence);
}

export function hydrateOrCreate(options?: SessionOptions): Session {
  if (!options?.persistence) return createSession(options);
  const storageKey = options.persistence.key ?? DEFAULT_STORAGE_KEY;
  const raw = options.persistence.storage.getItem(storageKey);
  if (!raw) return createSession(options);
  try {
    return deserialize(JSON.parse(raw), options);
  } catch {
    options.persistence.storage.removeItem(storageKey);
    return createSession(options);
  }
}

export const sessionFactory: SessionFactory = { createSession, deserialize };
