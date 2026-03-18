import { useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import type { NodeValue } from '@continuum-dev/core';
import { useRequiredContinuumContext } from './provider.js';
import { NodeStateScopeContext } from './scope.js';
import { shallowNodeValueEqual } from './shared.js';

/**
 * Subscribes to and updates a specific node value by canonical node id.
 *
 * @param nodeId Canonical node id.
 */
export function useContinuumState(
  nodeId: string
): [NodeValue | undefined, (value: NodeValue) => void] {
  const { session, store } = useRequiredContinuumContext('useContinuumState');
  const scope = useContext(NodeStateScopeContext);
  const valueCacheRef = useRef<NodeValue | undefined>(undefined);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (scope) {
        return scope.subscribeNode(nodeId, onStoreChange);
      }
      return store.subscribeNode(nodeId, onStoreChange);
    },
    [scope, store, nodeId]
  );

  const getSnapshot = useCallback(() => {
    const nextValue = scope
      ? scope.getNodeValue(nodeId)
      : store.getNodeValue(nodeId);
    const cachedValue = valueCacheRef.current;

    if (shallowNodeValueEqual(cachedValue, nextValue)) {
      return cachedValue;
    }

    valueCacheRef.current = nextValue;
    return nextValue;
  }, [scope, store, nodeId]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: NodeValue) => {
      if (scope) {
        scope.setNodeValue(nodeId, next);
        return;
      }
      session.updateState(nodeId, next);
    },
    [scope, session, nodeId]
  );

  return [value, setValue];
}
