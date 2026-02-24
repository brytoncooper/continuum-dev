import { INTERACTION_TYPES } from '@continuum/contract';
import type { Session, SessionOptions, SessionFactory } from './types.js';
import { createEmptySessionState, generateId } from './session/session-state.js';
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
    getSnapshot() { return buildSnapshotFromCurrentState(internal); },
    getIssues() { return [...internal.issues]; },
    getDiffs() { return [...internal.diffs]; },
    getTrace() { return [...internal.trace]; },
    getEventLog() { return [...internal.eventLog]; },
    getPendingActions() { return [...internal.pendingActions]; },
    getCheckpoints() { return [...internal.checkpoints]; },

    pushSchema(schema) { pushSchema(internal, schema); },
    recordIntent(partial) { recordIntent(internal, partial); },
    updateState(componentId, payload) {
      session.recordIntent({ componentId, type: INTERACTION_TYPES.STATE_UPDATE, payload });
    },

    submitAction(partial) { submitAction(internal, partial); },
    validateAction(actionId) { validateAction(internal, actionId); },
    cancelAction(actionId) { cancelAction(internal, actionId); },

    checkpoint() { return createManualCheckpoint(internal); },
    restoreFromCheckpoint(cp) { restoreFromCheckpoint(internal, cp); },
    rewind(checkpointId) { rewind(internal, checkpointId); },

    onSnapshot(listener) { return subscribeSnapshot(internal, listener); },
    onIssues(listener) { return subscribeIssues(internal, listener); },

    serialize() { return serializeSession(internal); },
    destroy() { return teardownSessionAndClearState(internal); },
  };

  return session;
}

export function createSession(options?: SessionOptions): Session {
  const clock = options?.clock ?? Date.now;
  return assembleSessionFromInternalState(
    createEmptySessionState(generateId('session', clock), clock)
  );
}

export function deserialize(data: unknown, options?: SessionOptions): Session {
  return assembleSessionFromInternalState(
    deserializeToState(data, options?.clock ?? Date.now)
  );
}

export const sessionFactory: SessionFactory = { createSession, deserialize };
