import { createContext, useContext, useCallback, useRef, useSyncExternalStore } from 'react';
import type { Session } from '@continuum/session';
import type { ContinuitySnapshot, NodeValue, ViewportState, ProposedValue } from '@continuum/contract';
import { ContinuumContext } from './context.js';

function shallowArrayEqual<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function shallowNodeValueEqual(
  left: NodeValue | undefined,
  right: NodeValue | undefined
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.value === right.value &&
    left.isDirty === right.isDirty &&
    left.isValid === right.isValid
  );
}

function shallowViewportEqual(
  left: ViewportState | undefined,
  right: ViewportState | undefined
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.scrollX === right.scrollX &&
    left.scrollY === right.scrollY &&
    left.zoom === right.zoom &&
    left.offsetX === right.offsetX &&
    left.offsetY === right.offsetY &&
    left.isExpanded === right.isExpanded &&
    left.isFocused === right.isFocused
  );
}

interface NodeStateScope {
  subscribeNode: (nodeId: string, listener: () => void) => () => void;
  getNodeValue: (nodeId: string) => NodeValue | undefined;
  setNodeValue: (nodeId: string, value: NodeValue) => void;
}

export const NodeStateScopeContext = createContext<NodeStateScope | null>(null);

export function useContinuumSession(): Session {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumSession must be used within a <ContinuumProvider>'
    );
  }
  return ctx.session;
}

export function useContinuumState(
  nodeId: string
): [NodeValue | undefined, (value: NodeValue) => void] {
  const ctx = useContext(ContinuumContext);
  const scope = useContext(NodeStateScopeContext);
  if (!ctx) {
    throw new Error(
      'useContinuumState must be used within a <ContinuumProvider>'
    );
  }
  const { session, store } = ctx;
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
  }, [store, nodeId]);

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

export function useContinuumSnapshot(): ContinuitySnapshot | null {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumSnapshot must be used within a <ContinuumProvider>'
    );
  }
  const { store } = ctx;
  const snapshotCacheRef = useRef<{
    view: ContinuitySnapshot['view'] | null;
    data: ContinuitySnapshot['data'] | null;
    snapshot: ContinuitySnapshot | null;
  }>({
    view: null,
    data: null,
    snapshot: null,
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSnapshot(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(() => {
    const nextSnapshot = store.getSnapshot();
    const cache = snapshotCacheRef.current;

    if (!nextSnapshot) {
      cache.view = null;
      cache.data = null;
      cache.snapshot = null;
      return null;
    }

    if (
      cache.snapshot &&
      cache.view === nextSnapshot.view &&
      cache.data === nextSnapshot.data
    ) {
      return cache.snapshot;
    }

    cache.view = nextSnapshot.view;
    cache.data = nextSnapshot.data;
    cache.snapshot = nextSnapshot;
    return nextSnapshot;
  }, [store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useContinuumViewport(
  nodeId: string
): [ViewportState | undefined, (state: ViewportState) => void] {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumViewport must be used within a <ContinuumProvider>'
    );
  }
  const { session, store } = ctx;
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

export function useContinuumDiagnostics() {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumDiagnostics must be used within a <ContinuumProvider>'
    );
  }
  const { session, store } = ctx;
  const diagnosticsCacheRef = useRef<{
    issues: ReturnType<Session['getIssues']>;
    diffs: ReturnType<Session['getDiffs']>;
    resolutions: ReturnType<Session['getResolutions']>;
    checkpoints: ReturnType<Session['getCheckpoints']>;
  } | null>(null);

  const getSnapshot = useCallback(
    () => {
      const nextDiagnostics = {
        issues: session.getIssues(),
        diffs: session.getDiffs(),
        resolutions: session.getResolutions(),
        checkpoints: session.getCheckpoints(),
      };
      const cachedDiagnostics = diagnosticsCacheRef.current;

      if (
        cachedDiagnostics &&
        shallowArrayEqual(cachedDiagnostics.issues, nextDiagnostics.issues) &&
        shallowArrayEqual(cachedDiagnostics.diffs, nextDiagnostics.diffs) &&
        shallowArrayEqual(cachedDiagnostics.resolutions, nextDiagnostics.resolutions) &&
        shallowArrayEqual(cachedDiagnostics.checkpoints, nextDiagnostics.checkpoints)
      ) {
        return cachedDiagnostics;
      }

      diagnosticsCacheRef.current = nextDiagnostics;
      return nextDiagnostics;
    },
    [session]
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeDiagnostics(onStoreChange),
    [store]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useContinuumHydrated(): boolean {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumHydrated must be used within a <ContinuumProvider>'
    );
  }
  return ctx.wasHydrated;
}

export function useContinuumConflict(nodeId: string): {
  hasConflict: boolean;
  proposal: ProposedValue | null;
  accept: () => void;
  reject: () => void;
} {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumConflict must be used within a <ContinuumProvider>'
    );
  }
  const { session } = ctx;

  const proposal = session.getPendingProposals()[nodeId] ?? null;

  const accept = useCallback(() => {
    session.acceptProposal(nodeId);
  }, [session, nodeId]);

  const reject = useCallback(() => {
    session.rejectProposal(nodeId);
  }, [session, nodeId]);

  return {
    hasConflict: proposal !== null,
    proposal,
    accept,
    reject,
  };
}
