import { createContext, useContext, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import type {
  ActionResult,
  ContinuitySnapshot,
  NodeValue,
  ProposedValue,
  Session,
  ViewportState,
} from '@continuum/core';
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
    left.isValid === right.isValid &&
    left.suggestion === right.suggestion
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

/**
 * Internal scope context used by collection item renderers to map local node ids
 * onto collection-backed values.
 */
export const NodeStateScopeContext = createContext<NodeStateScope | null>(null);

/**
 * Returns the active Continuum session from provider context.
 */
export function useContinuumSession(): Session {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumSession must be used within a <ContinuumProvider>'
    );
  }
  return ctx.session;
}

/**
 * Subscribes to and updates a specific node value by canonical node id.
 *
 * @param nodeId Canonical node id.
 */
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

/**
 * Subscribes to the full continuity snapshot.
 */
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

/**
 * Subscribes to and updates viewport state for a specific node.
 *
 * @param nodeId Canonical node id.
 */
export function useContinuumViewport(
  nodeId: string
): [ViewportState | undefined, (state: ViewportState) => void] {
  const ctx = useContext(ContinuumContext);
  const scope = useContext(NodeStateScopeContext);
  if (!ctx) {
    throw new Error(
      'useContinuumViewport must be used within a <ContinuumProvider>'
    );
  }
  if (
    scope
    && typeof process !== 'undefined'
    && process.env.NODE_ENV !== 'production'
  ) {
    console.warn(
      `useContinuumViewport("${nodeId}") called inside a collection scope. Viewport state is not supported for collection item nodes.`
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

/**
 * Subscribes to session diagnostics (`issues`, `diffs`, `resolutions`, checkpoints).
 */
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

/**
 * Indicates whether the provider session was restored from persistence.
 */
export function useContinuumHydrated(): boolean {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumHydrated must be used within a <ContinuumProvider>'
    );
  }
  return ctx.wasHydrated;
}

/**
 * Returns conflict state and resolution actions for one node.
 *
 * @param nodeId Canonical node id.
 */
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
  const { session, store } = ctx;
  const proposalCacheRef = useRef<ProposedValue | null>(null);
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSnapshot(onStoreChange),
    [store]
  );
  const getSnapshot = useCallback(() => {
    const nextProposal = session.getPendingProposals()[nodeId] ?? null;
    const cachedProposal = proposalCacheRef.current;
    if (cachedProposal === nextProposal) {
      return cachedProposal;
    }
    proposalCacheRef.current = nextProposal;
    return nextProposal;
  }, [session, nodeId]);
  const proposal = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

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

/**
 * Aggregates suggestion state and exposes bulk accept/reject operations.
 */
export function useContinuumSuggestions(): {
  hasSuggestions: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
} {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumSuggestions must be used within a <ContinuumProvider>'
    );
  }
  const { session, store } = ctx;

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSnapshot(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) return false;
    let found = false;
    for (const key of Object.keys(snap.data.values)) {
      if (snap.data.values[key]?.suggestion !== undefined) {
        found = true;
        break;
      }
    }
    return found;
  }, [store]);

  const hasSuggestions = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const acceptAll = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) return;
    for (const key of Object.keys(snap.data.values)) {
      const nodeVal = snap.data.values[key];
      if (nodeVal?.suggestion !== undefined) {
        session.updateState(key, {
          ...nodeVal,
          value: nodeVal.suggestion,
          suggestion: undefined,
          isDirty: true
        } as NodeValue);
      }
    }
  }, [session, store]);

  const rejectAll = useCallback(() => {
    const snap = store.getSnapshot();
    if (!snap || !snap.data) return;
    for (const key of Object.keys(snap.data.values)) {
      const nodeVal = snap.data.values[key];
      if (nodeVal?.suggestion !== undefined) {
        session.updateState(key, {
          ...nodeVal,
          suggestion: undefined
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

/**
 * Returns an action dispatcher bound to an intent id with dispatch state.
 *
 * @param intentId Registered action intent id to dispatch.
 */
export function useContinuumAction(intentId: string): {
  dispatch: (nodeId: string) => Promise<ActionResult>;
  isDispatching: boolean;
  lastResult: ActionResult | null;
} {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'useContinuumAction must be used within a <ContinuumProvider>'
    );
  }
  const { session } = ctx;
  const [isDispatching, setIsDispatching] = useState(false);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const dispatchIdRef = useRef(0);

  const dispatch = useCallback(
    async (nodeId: string) => {
      const dispatchId = ++dispatchIdRef.current;
      setIsDispatching(true);
      try {
        const result = await session.dispatchAction(intentId, nodeId);
        if (dispatchIdRef.current === dispatchId) {
          setLastResult(result);
        }
        return result;
      } finally {
        if (dispatchIdRef.current === dispatchId) {
          setIsDispatching(false);
        }
      }
    },
    [session, intentId]
  );

  return { dispatch, isDispatching, lastResult };
}
