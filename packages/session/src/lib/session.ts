import { INTERACTION_TYPES } from '@continuum-dev/contract';
import type {
  ViewportState,
  DetachedValue,
  NodeValue,
  ActionRegistration,
  ActionHandler,
  ActionResult,
  ActionSessionRef,
} from '@continuum-dev/contract';
import type { Session, SessionOptions, SessionFactory } from './types.js';
import {
  createEmptySessionState,
  generateId,
  resetSessionState,
} from './session/session-state.js';
import type { SessionState } from './session/session-state.js';
import {
  buildSnapshotFromCurrentState,
  notifySnapshotListeners,
  subscribeSnapshot,
  subscribeIssues,
} from './session/listeners.js';
import {
  cloneCheckpointSnapshot,
  createManualCheckpoint,
  restoreFromCheckpoint,
  rewind,
} from './session/checkpoint-manager.js';
import {
  submitIntent,
  validateIntent,
  cancelIntent,
} from './session/intent-manager.js';
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
    get sessionId() {
      return internal.sessionId;
    },
    get isDestroyed() {
      return internal.destroyed;
    },
    getSnapshot() {
      assertNotDestroyed(internal);
      return buildSnapshotFromCurrentState(internal);
    },
    getIssues() {
      assertNotDestroyed(internal);
      return [...internal.issues];
    },
    getDiffs() {
      assertNotDestroyed(internal);
      return [...internal.diffs];
    },
    getResolutions() {
      assertNotDestroyed(internal);
      return [...internal.resolutions];
    },
    getEventLog() {
      assertNotDestroyed(internal);
      return [...internal.eventLog];
    },
    getPendingIntents() {
      assertNotDestroyed(internal);
      return [...internal.pendingIntents];
    },
    getDetachedValues() {
      assertNotDestroyed(internal);
      return { ...(internal.currentData?.detachedValues ?? {}) };
    },
    purgeDetachedValues(
      filter?: (key: string, value: DetachedValue) => boolean
    ) {
      assertNotDestroyed(internal);
      if (!internal.currentData?.detachedValues) return;
      if (!filter) {
        const { detachedValues: _, ...rest } = internal.currentData;
        internal.currentData = rest;
      } else {
        const remaining: Record<string, DetachedValue> = {};
        for (const [key, value] of Object.entries(
          internal.currentData.detachedValues
        )) {
          if (!filter(key, value)) {
            remaining[key] = value;
          }
        }
        if (Object.keys(remaining).length === 0) {
          const { detachedValues: _, ...rest } = internal.currentData;
          internal.currentData = rest;
        } else {
          internal.currentData = {
            ...internal.currentData,
            detachedValues: remaining,
          };
        }
      }
      notifySnapshotListeners(internal);
    },
    proposeValue(nodeId: string, value: NodeValue, source?: string) {
      assertNotDestroyed(internal);
      if (!internal.currentData) return;
      const existing = internal.currentData.values[nodeId] as
        | NodeValue
        | undefined;
      if (existing && (existing.isDirty || existing.isSticky)) {
        internal.pendingProposals[nodeId] = {
          nodeId,
          proposedValue: value,
          currentValue: existing,
          proposedAt: internal.clock(),
          source,
        };
        notifySnapshotListeners(internal);
      } else {
        recordIntent(internal, {
          nodeId,
          type: INTERACTION_TYPES.DATA_UPDATE,
          payload: value,
        });
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
        payload: { ...proposal.proposedValue, isDirty: true },
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
    getCheckpoints() {
      assertNotDestroyed(internal);
      return [...internal.checkpoints];
    },

    pushView(view) {
      assertNotDestroyed(internal);
      pushView(internal, view);
    },
    recordIntent(partial) {
      assertNotDestroyed(internal);
      recordIntent(internal, partial);
    },
    updateState(nodeId, payload) {
      assertNotDestroyed(internal);
      recordIntent(internal, {
        nodeId,
        type: INTERACTION_TYPES.DATA_UPDATE,
        payload,
      });
    },
    getViewportState(nodeId) {
      assertNotDestroyed(internal);
      return internal.currentData?.viewContext?.[nodeId];
    },
    updateViewportState(nodeId, state) {
      assertNotDestroyed(internal);
      applyViewportStateUpdate(internal, nodeId, state);
    },

    submitIntent(partial) {
      assertNotDestroyed(internal);
      submitIntent(internal, partial);
    },
    validateIntent(intentId) {
      assertNotDestroyed(internal);
      return validateIntent(internal, intentId);
    },
    cancelIntent(intentId) {
      assertNotDestroyed(internal);
      return cancelIntent(internal, intentId);
    },

    checkpoint() {
      assertNotDestroyed(internal);
      return createManualCheckpoint(internal);
    },
    restoreFromCheckpoint(cp) {
      assertNotDestroyed(internal);
      restoreFromCheckpoint(internal, cp);
    },
    rewind(checkpointId) {
      assertNotDestroyed(internal);
      rewind(internal, checkpointId);
    },
    reset() {
      assertNotDestroyed(internal);
      resetSessionState(internal);
      notifySnapshotListeners(internal);
    },

    onSnapshot(listener) {
      assertNotDestroyed(internal);
      return subscribeSnapshot(internal, listener);
    },
    onIssues(listener) {
      assertNotDestroyed(internal);
      return subscribeIssues(internal, listener);
    },

    serialize() {
      assertNotDestroyed(internal);
      return serializeSession(internal);
    },
    destroy() {
      assertNotDestroyed(internal);
      cleanupPersistence?.();
      return teardownSessionAndClearState(internal);
    },
    registerAction(
      intentId: string,
      registration: ActionRegistration,
      handler: ActionHandler
    ) {
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
    async dispatchAction(
      intentId: string,
      nodeId: string
    ): Promise<ActionResult> {
      assertNotDestroyed(internal);
      const entry = internal.actionRegistry.get(intentId);
      if (!entry) {
        console.warn(
          `[Continuum] dispatchAction: no handler registered for intentId "${intentId}"`
        );
        return {
          success: false,
          error: `No handler registered for intentId "${intentId}"`,
        };
      }
      const snapshot = buildSnapshotFromCurrentState(internal);
      if (!snapshot) {
        return { success: false, error: 'No active snapshot' };
      }
      const sessionRef: ActionSessionRef = {
        pushView: (v) => session.pushView(v),
        updateState: (id, p) => session.updateState(id, p),
        getSnapshot: () => session.getSnapshot(),
        proposeValue: (id, v, s) => session.proposeValue(id, v, s),
      };
      try {
        const raw = await entry.handler({
          intentId,
          snapshot: snapshot.data,
          nodeId,
          session: sessionRef,
        });
        return raw ?? { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    async executeIntent(partial) {
      assertNotDestroyed(internal);
      submitIntent(internal, partial);
      const intent =
        internal.pendingIntents[internal.pendingIntents.length - 1];
      try {
        const result = await session.dispatchAction(
          partial.intentName,
          partial.nodeId
        );
        if (result.success) {
          validateIntent(internal, intent.intentId);
        } else {
          cancelIntent(internal, intent.intentId);
        }
        return result;
      } catch (error) {
        cancelIntent(internal, intent.intentId);
        return { success: false, error };
      }
    },
  };

  return session;
}

/**
 * Creates a new in-memory session ledger.
 *
 * Initializes event log limits, reconciliation behavior, optional persistence,
 * and optional action handlers.
 *
 * @param options Optional session configuration.
 * @returns A live session instance.
 */
export function createSession(options?: SessionOptions): Session {
  const clock = options?.clock ?? Date.now;
  const internal = createEmptySessionState(generateId('session', clock), clock);
  internal.maxEventLogSize =
    options?.maxEventLogSize ?? internal.maxEventLogSize;
  internal.maxPendingIntents =
    options?.maxPendingIntents ?? internal.maxPendingIntents;
  internal.maxCheckpoints = options?.maxCheckpoints ?? internal.maxCheckpoints;
  internal.reconciliationOptions = options?.reconciliation;
  internal.validateOnUpdate =
    options?.validateOnUpdate ?? internal.validateOnUpdate;
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

/**
 * Recreates a session from serialized data produced by `session.serialize()`.
 *
 * @param data Serialized session payload.
 * @param options Optional runtime overrides (clock, limits, reconciliation, persistence).
 * @returns A live session instance restored from the payload.
 */
export function deserialize(data: unknown, options?: SessionOptions): Session {
  const internal = deserializeToState(data, options?.clock ?? Date.now, {
    maxEventLogSize: options?.maxEventLogSize,
    maxPendingIntents: options?.maxPendingIntents,
    maxCheckpoints: options?.maxCheckpoints,
  });
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

/**
 * Hydrates a session from persistence storage when data exists, otherwise creates a new one.
 *
 * If stored data is invalid, it is removed and a fresh session is created.
 *
 * @param options Session options including required persistence config.
 * @returns A hydrated or newly created session.
 */
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

/**
 * Dependency-injection friendly factory for session creation and deserialization.
 */
export const sessionFactory: SessionFactory = { createSession, deserialize };
