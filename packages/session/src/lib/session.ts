import { INTERACTION_TYPES } from '@continuum/contract';
import type { Session, SessionOptions, SessionFactory } from './types.js';
import { createEmptySessionState, generateId, resetSessionState } from './session/session-state.js';
import type { SessionState } from './session/session-state.js';
import { buildSnapshotFromCurrentState, subscribeSnapshot, subscribeIssues } from './session/listeners.js';
import { createManualCheckpoint, restoreFromCheckpoint, rewind } from './session/checkpoint-manager.js';
import { submitIntent, validateIntent, cancelIntent } from './session/intent-manager.js';
import { recordIntent } from './session/event-log.js';
import { pushView } from './session/view-pusher.js';
import { serializeSession, deserializeToState } from './session/serializer.js';
import { teardownSessionAndClearState } from './session/destroyer.js';
import { attachPersistence } from './session/persistence.js';

const DEFAULT_STORAGE_KEY = 'continuum_session';

function assembleSessionFromInternalState(
  internal: SessionState,
  cleanupPersistence?: () => void
): Session {
  const session: Session = {
    get sessionId() { return internal.sessionId; },
    getSnapshot() { return internal.destroyed ? null : buildSnapshotFromCurrentState(internal); },
    getIssues() { return internal.destroyed ? [] : [...internal.issues]; },
    getDiffs() { return internal.destroyed ? [] : [...internal.diffs]; },
    getResolutions() { return internal.destroyed ? [] : [...internal.resolutions]; },
    getEventLog() { return internal.destroyed ? [] : [...internal.eventLog]; },
    getPendingIntents() { return internal.destroyed ? [] : [...internal.pendingIntents]; },
    getDetachedValues() {
      if (internal.destroyed) return {};
      return { ...(internal.currentData?.detachedValues ?? {}) };
    },
    getCheckpoints() { return internal.destroyed ? [] : [...internal.checkpoints]; },

    pushView(view) { pushView(internal, view); },
    recordIntent(partial) { recordIntent(internal, partial); },
    updateState(nodeId, payload) {
      recordIntent(internal, { nodeId, type: INTERACTION_TYPES.DATA_UPDATE, payload });
    },

    submitIntent(partial) { submitIntent(internal, partial); },
    validateIntent(intentId) { return validateIntent(internal, intentId); },
    cancelIntent(intentId) { return cancelIntent(internal, intentId); },

    checkpoint() { return createManualCheckpoint(internal); },
    restoreFromCheckpoint(cp) { restoreFromCheckpoint(internal, cp); },
    rewind(checkpointId) { rewind(internal, checkpointId); },
    reset() {
      if (internal.destroyed) return;
      resetSessionState(internal);
    },

    onSnapshot(listener) { return subscribeSnapshot(internal, listener); },
    onIssues(listener) { return subscribeIssues(internal, listener); },

    serialize() { return serializeSession(internal); },
    destroy() {
      cleanupPersistence?.();
      return teardownSessionAndClearState(internal);
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
