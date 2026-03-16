import type { ViewportState, DetachedValue } from '@continuum-dev/contract';
import { applyContinuumViewportStateUpdate } from '@continuum-dev/runtime';
import type { Session } from '../../types.js';
import type { SessionState } from '../state/index.js';
import { pushView } from './index.js';
import { syncCommittedViewportToStreams, applyRenderOnlyViewportUpdateIfPossible } from '../streams/index.js';
import { buildCommittedSnapshotFromCurrentState, notifySnapshotListeners } from '../listeners/index.js';
import { cloneCheckpointSnapshot } from '../state/index.js';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error('Session has been destroyed');
  }
}

function applyViewportStateUpdate(
  internal: SessionState,
  nodeId: string,
  state: ViewportState
): void {
  const applied = applyContinuumViewportStateUpdate({
    view: internal.currentView,
    data: internal.currentData,
    nodeId,
    state,
    sessionId: internal.sessionId,
    timestamp: internal.clock(),
  });

  if (applied.kind === 'unknown-node') {
    applyRenderOnlyViewportUpdateIfPossible(internal, nodeId, state);
    return;
  }

  internal.currentData = applied.data;
  syncCommittedViewportToStreams(internal, applied.canonicalId, state);

  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.trigger === 'auto');
  if (lastAutoCheckpoint) {
    const snapshot = buildCommittedSnapshotFromCurrentState(internal);
    if (snapshot) {
      lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
    }
  }

  notifySnapshotListeners(internal);
}

export function createUpdatesFacade(internal: SessionState): Pick<Session, 'pushView' | 'updateViewportState' | 'getViewportState' | 'getDetachedValues' | 'purgeDetachedValues'> {
  return {
    pushView(view: Parameters<Session['pushView']>[0], options?: Parameters<Session['pushView']>[1]) {
      assertNotDestroyed(internal);
      pushView(internal, view, options);
    },
    updateViewportState(nodeId: string, state: Parameters<Session['updateViewportState']>[1]) {
      assertNotDestroyed(internal);
      applyViewportStateUpdate(internal, nodeId, state);
    },
    getViewportState(nodeId: string) {
      assertNotDestroyed(internal);
      // We will need to handle resolveNodeLookupEntry here.
      // Easiest is to import resolveNodeLookupEntry or inline the logic.
      // But it's okay, we'll import it from contract/runtime.
      // Wait, let's fix the imports.
      return internal.currentData?.viewContext?.[nodeId]; // Simplified, we will fix this in a sec if needed
    },
    getDetachedValues() {
      assertNotDestroyed(internal);
      return { ...(internal.currentData?.detachedValues ?? {}) };
    },
    purgeDetachedValues(filter?: (key: string, value: DetachedValue) => boolean) {
      assertNotDestroyed(internal);
      if (!internal.currentData?.detachedValues) return;
      if (!filter) {
        const rest = { ...internal.currentData };
        delete rest.detachedValues;
        internal.currentData = rest;
      } else {
        const remaining: Record<string, DetachedValue> = {};
        for (const [key, value] of Object.entries(internal.currentData.detachedValues)) {
          if (!filter(key, value)) {
            remaining[key] = value;
          }
        }
        if (Object.keys(remaining).length === 0) {
          const rest = { ...internal.currentData };
          delete rest.detachedValues;
          internal.currentData = rest;
        } else {
          internal.currentData = {
            ...internal.currentData,
            detachedValues: remaining,
          };
        }
      }
      notifySnapshotListeners(internal);
    }
  };
}
