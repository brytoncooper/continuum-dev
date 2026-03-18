import { useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import type { ViewportState } from '@continuum-dev/core';
import { useRequiredContinuumContext } from './provider.js';
import { NodeStateScopeContext } from './scope.js';
import { shallowViewportEqual } from './shared.js';

/**
 * Subscribes to and updates viewport state for a specific node.
 *
 * @param nodeId Canonical node id.
 */
export function useContinuumViewport(
  nodeId: string
): [ViewportState | undefined, (state: ViewportState) => void] {
  const { session, store } = useRequiredContinuumContext('useContinuumViewport');
  const scope = useContext(NodeStateScopeContext);
  if (
    scope &&
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'production'
  ) {
    console.warn(
      `useContinuumViewport("${nodeId}") called inside a collection scope. Viewport state is not supported for collection item nodes.`
    );
  }
  const viewportCacheRef = useRef<ViewportState | undefined>(undefined);

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeNode(nodeId, onStoreChange),
    [store, nodeId]
  );

  const getSnapshot = useCallback(() => {
    const nextValue = store.getNodeViewport(nodeId);
    const cachedValue = viewportCacheRef.current;
    if (shallowViewportEqual(cachedValue, nextValue)) {
      return cachedValue;
    }
    viewportCacheRef.current = nextValue;
    return nextValue;
  }, [store, nodeId]);

  const viewport = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setViewport = useCallback(
    (next: ViewportState) => {
      session.updateViewportState(nodeId, next);
    },
    [session, nodeId]
  );

  return [viewport, setViewport];
}
