import { INTERACTION_TYPES } from '@continuum/contract';
import type { Session, SessionOptions, SessionFactory } from './types.js';
import { createEmptySessionState, generateId, resetSessionState } from './session/session-state.js';
import type { SessionState } from './session/session-state.js';
import { buildSnapshotFromCurrentState, subscribeSnapshot, subscribeIssues } from './session/listeners.js';
import { createManualCheckpoint, restoreFromCheckpoint, rewind } from './session/checkpoint-manager.js';
import { submitAction, validateAction, cancelAction } from './session/action-manager.js';
import { recordIntent } from './session/event-log.js';
import { pushSchema } from './session/schema-pusher.js';
import { serializeSession, deserializeToState } from './session/serializer.js';
import { teardownSessionAndClearState } from './session/destroyer.js';

function assembleSessionFromInternalState(internal: SessionState): Session {
  const session: Session = {
    get sessionId() { return internal.sessionId; },
    getSnapshot() { return internal.destroyed ? null : buildSnapshotFromCurrentState(internal); },
    getIssues() { return internal.destroyed ? [] : [...internal.issues]; },
    getDiffs() { return internal.destroyed ? [] : [...internal.diffs]; },
    getTrace() { return internal.destroyed ? [] : [...internal.trace]; },
    getEventLog() { return internal.destroyed ? [] : [...internal.eventLog]; },
    getPendingActions() { return internal.destroyed ? [] : [...internal.pendingActions]; },
    getOrphanedValues() {
      if (internal.destroyed) return {};
      return { ...(internal.currentState?.orphanedValues ?? {}) };
    },
    getCheckpoints() { return internal.destroyed ? [] : [...internal.checkpoints]; },

    pushSchema(schema) { pushSchema(internal, schema); },
    recordIntent(partial) { recordIntent(internal, partial); },
    updateState(componentId, payload) {
      recordIntent(internal, { componentId, type: INTERACTION_TYPES.STATE_UPDATE, payload });
    },

    submitAction(partial) { submitAction(internal, partial); },
    validateAction(actionId) { return validateAction(internal, actionId); },
    cancelAction(actionId) { return cancelAction(internal, actionId); },

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
    destroy() { return teardownSessionAndClearState(internal); },
  };

  return session;
}

export function createSession(options?: SessionOptions): Session {
  const clock = options?.clock ?? Date.now;
  const internal = createEmptySessionState(generateId('session', clock), clock);
  internal.maxEventLogSize = options?.maxEventLogSize ?? internal.maxEventLogSize;
  internal.maxPendingActions = options?.maxPendingActions ?? internal.maxPendingActions;
  internal.maxCheckpoints = options?.maxCheckpoints ?? internal.maxCheckpoints;
  internal.reconciliationOptions = options?.reconciliation;
  internal.validateOnUpdate = options?.validateOnUpdate ?? internal.validateOnUpdate;
  return assembleSessionFromInternalState(
    internal
  );
}

export function deserialize(data: unknown, options?: SessionOptions): Session {
  const internal = deserializeToState(
    data,
    options?.clock ?? Date.now,
    {
      maxEventLogSize: options?.maxEventLogSize,
      maxPendingActions: options?.maxPendingActions,
      maxCheckpoints: options?.maxCheckpoints,
    }
  );
  if (options?.reconciliation) {
    internal.reconciliationOptions = options.reconciliation;
  }
  if (options?.validateOnUpdate !== undefined) {
    internal.validateOnUpdate = options.validateOnUpdate;
  }
  return assembleSessionFromInternalState(internal);
}

export const sessionFactory: SessionFactory = { createSession, deserialize };
