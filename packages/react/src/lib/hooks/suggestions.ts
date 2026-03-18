import { useCallback, useSyncExternalStore } from 'react';
import type { NodeValue } from '@continuum-dev/core';
import { useRequiredContinuumContext } from './provider.js';

/**
 * Aggregates suggestion state and exposes bulk accept/reject operations.
 */
export function useContinuumSuggestions(): {
  hasSuggestions: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
} {
  const { session, store } = useRequiredContinuumContext(
    'useContinuumSuggestions'
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSnapshot(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) {
      return false;
    }
    let found = false;
    for (const key of Object.keys(snap.data.values)) {
      if (snap.data.values[key]?.suggestion !== undefined) {
        found = true;
        break;
      }
    }
    return found;
  }, [store]);

  const hasSuggestions = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  const acceptAll = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) {
      return;
    }
    for (const key of Object.keys(snap.data.values)) {
      const nodeVal = snap.data.values[key];
      if (nodeVal?.suggestion !== undefined) {
        session.updateState(key, {
          ...nodeVal,
          value: nodeVal.suggestion,
          suggestion: undefined,
          isDirty: true,
        } as NodeValue);
      }
    }
  }, [session, store]);

  const rejectAll = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) {
      return;
    }
    for (const key of Object.keys(snap.data.values)) {
      const nodeVal = snap.data.values[key];
      if (nodeVal?.suggestion !== undefined) {
        session.updateState(key, {
          ...nodeVal,
          suggestion: undefined,
        } as NodeValue);
      }
    }
  }, [session, store]);

  return {
    hasSuggestions,
    acceptAll,
    rejectAll,
  };
}
