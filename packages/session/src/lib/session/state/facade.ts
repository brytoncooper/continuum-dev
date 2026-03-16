import type { Session } from '../../types.js';
import type { SessionState } from './index.js';
import {
  buildCommittedSnapshotFromCurrentState,
  buildRenderSnapshotFromCurrentState,
} from '../listeners/index.js';
import { createManualCheckpoint, restoreFromCheckpoint, rewind, resetSessionState, teardownSessionAndClearState, serializeSession } from './index.js';
import { notifySnapshotAndIssueListeners, notifyStreamListeners } from '../listeners/index.js';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error('Session has been destroyed');
  }
}

export function createStateFacade(internal: SessionState, cleanupPersistence?: () => void): Pick<Session, 'sessionId' | 'isDestroyed' | 'getSnapshot' | 'getCommittedSnapshot' | 'getEventLog' | 'getCheckpoints' | 'checkpoint' | 'restoreFromCheckpoint' | 'rewind' | 'reset' | 'serialize' | 'destroy'> {
  return {
    get sessionId() {
      return internal.sessionId;
    },
    get isDestroyed() {
      return internal.destroyed;
    },
    getSnapshot() {
      assertNotDestroyed(internal);
      return buildRenderSnapshotFromCurrentState(internal);
    },
    getCommittedSnapshot() {
      assertNotDestroyed(internal);
      return buildCommittedSnapshotFromCurrentState(internal);
    },
    getEventLog() {
      assertNotDestroyed(internal);
      return [...internal.eventLog];
    },
    getCheckpoints() {
      assertNotDestroyed(internal);
      return [...internal.checkpoints];
    },
    checkpoint() {
      assertNotDestroyed(internal);
      return createManualCheckpoint(internal);
    },
    restoreFromCheckpoint(cp: Parameters<Session['restoreFromCheckpoint']>[0]) {
        assertNotDestroyed(internal);
        restoreFromCheckpoint(internal, cp);
    },
    rewind(checkpointId: string) {
      assertNotDestroyed(internal);
      rewind(internal, checkpointId);
    },
    reset() {
      assertNotDestroyed(internal);
      resetSessionState(internal);
      notifySnapshotAndIssueListeners(internal);
      notifyStreamListeners(internal);
    },
    serialize() {
      assertNotDestroyed(internal);
      return serializeSession(internal);
    },
    destroy() {
      assertNotDestroyed(internal);
      cleanupPersistence?.();
      return teardownSessionAndClearState(internal);
    }
  };
}
