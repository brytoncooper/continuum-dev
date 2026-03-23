import type { DetachedValue } from '@continuum-dev/contract';
import type { Session } from '../../types.js';
import { applyFocusedNodeId } from '../focus.js';
import type { SessionState } from '../state/index.js';
import { pushView } from './index.js';
import { notifySnapshotListeners } from '../listeners/index.js';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error('Session has been destroyed');
  }
}

export function createUpdatesFacade(
  internal: SessionState
): Pick<
  Session,
  | 'pushView'
  | 'setFocusedNodeId'
  | 'getFocusedNodeId'
  | 'getDetachedValues'
  | 'purgeDetachedValues'
> {
  return {
    pushView(
      view: Parameters<Session['pushView']>[0],
      options?: Parameters<Session['pushView']>[1]
    ) {
      assertNotDestroyed(internal);
      pushView(internal, view, options);
    },
    setFocusedNodeId(nodeId: string | null) {
      assertNotDestroyed(internal);
      applyFocusedNodeId(internal, nodeId);
    },
    getFocusedNodeId() {
      assertNotDestroyed(internal);
      return internal.focusedNodeId;
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
        const rest = { ...internal.currentData };
        delete rest.detachedValues;
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
    },
  };
}
