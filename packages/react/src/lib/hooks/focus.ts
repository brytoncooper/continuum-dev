import { useCallback, useContext, useSyncExternalStore } from 'react';
import { useRequiredContinuumContext } from './provider.js';
import { NodeStateScopeContext } from './scope.js';

export function useContinuumFocus(
  nodeId: string
): [boolean, (focused: boolean) => void] {
  const { session, store } = useRequiredContinuumContext('useContinuumFocus');
  const scope = useContext(NodeStateScopeContext);
  if (
    scope &&
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'production'
  ) {
    console.warn(
      `useContinuumFocus("${nodeId}") called inside a collection scope. Focus is not supported for collection item nodes.`
    );
  }
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubNode = store.subscribeNode(nodeId, onStoreChange);
      const unsubFocus = session.onFocusChange(onStoreChange);
      return () => {
        unsubNode();
        unsubFocus();
      };
    },
    [store, session, nodeId]
  );
  const getSnapshot = useCallback(
    () => store.getFocusedNodeId() === nodeId,
    [store, nodeId]
  );
  const isFocused = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setFocused = useCallback(
    (focused: boolean) => {
      if (focused) {
        session.setFocusedNodeId(nodeId);
      } else if (session.getFocusedNodeId() === nodeId) {
        session.setFocusedNodeId(null);
      }
    },
    [session, nodeId]
  );
  return [isFocused, setFocused];
}
