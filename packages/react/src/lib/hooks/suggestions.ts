import { useCallback, useSyncExternalStore } from 'react';
import {
  mapNestedCollectionValues,
  type NodeValue,
} from '@continuum-dev/core';
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

  const applyReviewedSuggestion = useCallback((nodeVal: NodeValue): NodeValue => {
    const next = {
      ...nodeVal,
      value: nodeVal.suggestion,
      suggestion: undefined,
      protection: {
        owner: 'ai' as const,
        stage: 'reviewed' as const,
      },
    } as NodeValue;
    delete next.isDirty;

    next.value = mapNestedCollectionValues(next.value, (nestedValue) => {
      const reviewedNestedValue = {
        ...nestedValue,
        suggestion: undefined,
        protection: {
          owner: 'ai',
          stage: 'reviewed',
        },
      } as NodeValue;
      delete reviewedNestedValue.isDirty;
      return reviewedNestedValue;
    });

    return next;
  }, []);

  const rejectSuggestion = useCallback((nodeVal: NodeValue): NodeValue => {
    const shouldReviewCurrent =
      nodeVal.isDirty !== true &&
      (nodeVal.protection?.owner ?? 'ai') === 'ai' &&
      (nodeVal.protection?.stage ?? 'flexible') === 'flexible';

    const next = {
      ...nodeVal,
      suggestion: undefined,
      ...(shouldReviewCurrent
        ? {
            protection: {
              owner: 'ai' as const,
              stage: 'reviewed' as const,
            },
          }
        : {}),
    } as NodeValue;

    if (shouldReviewCurrent) {
      next.value = mapNestedCollectionValues(next.value, (nestedValue) => ({
        ...nestedValue,
        suggestion: undefined,
        protection: {
          owner: 'ai',
          stage: 'reviewed',
        },
      }));
    }

    return next;
  }, []);

  const acceptAll = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) {
      return;
    }
    for (const key of Object.keys(snap.data.values)) {
      const nodeVal = snap.data.values[key];
      if (nodeVal?.suggestion !== undefined) {
        session.updateState(key, applyReviewedSuggestion(nodeVal));
      }
    }
  }, [applyReviewedSuggestion, session, store]);

  const rejectAll = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) {
      return;
    }
    for (const key of Object.keys(snap.data.values)) {
      const nodeVal = snap.data.values[key];
      if (nodeVal?.suggestion !== undefined) {
        session.updateState(key, rejectSuggestion(nodeVal));
      }
    }
  }, [rejectSuggestion, session, store]);

  return {
    hasSuggestions,
    acceptAll,
    rejectAll,
  };
}
