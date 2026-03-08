import { createContext, useRef, useMemo, useEffect } from 'react';
import { hydrateOrCreate } from '@continuum/core';
import type { Session, ContinuitySnapshot, NodeValue, ViewportState } from '@continuum/core';
import type { ContinuumNodeMap, ContinuumProviderProps } from './types.js';

type Listener = () => void;

function notifyListeners(listeners: Set<Listener>): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (e) {
      console.error('Continuum listener error', e);
    }
  }
}

function getChangedNodeIds(
  previous: ContinuitySnapshot | null,
  next: ContinuitySnapshot | null
): string[] {
  if (!previous || !next) {
    return [];
  }
  const previousValues = previous.data.values ?? {};
  const nextValues = next.data.values ?? {};
  const previousViewContext = previous.data.viewContext ?? {};
  const nextViewContext = next.data.viewContext ?? {};
  if (
    previousValues === nextValues &&
    previousViewContext === nextViewContext
  ) {
    return [];
  }
  const ids = new Set<string>([
    ...Object.keys(previousValues),
    ...Object.keys(nextValues),
    ...Object.keys(previousViewContext),
    ...Object.keys(nextViewContext),
  ]);
  const changed: string[] = [];
  for (const id of ids) {
    const previousValue = previousValues[id] as NodeValue | undefined;
    const nextValue = nextValues[id] as NodeValue | undefined;
    const previousViewport = previousViewContext[id] as ViewportState | undefined;
    const nextViewport = nextViewContext[id] as ViewportState | undefined;
    if (
      previousValue !== nextValue ||
      previousViewport !== nextViewport
    ) {
      changed.push(id);
    }
  }
  return changed;
}

/**
 * Subscription-oriented store facade over Continuum session state.
 */
export interface ContinuumStore {
  /** Returns the latest continuity snapshot. */
  getSnapshot(): ContinuitySnapshot | null;
  /** Subscribes to snapshot updates. */
  subscribeSnapshot(listener: Listener): () => void;
  /** Subscribes to diagnostics-related updates. */
  subscribeDiagnostics(listener: Listener): () => void;
  /** Returns a node value by canonical id. */
  getNodeValue(nodeId: string): NodeValue | undefined;
  /** Returns viewport state by canonical node id. */
  getNodeViewport(nodeId: string): ViewportState | undefined;
  /** Subscribes to updates for a specific node id. */
  subscribeNode(nodeId: string, listener: Listener): () => void;
  /** Releases store subscriptions and listeners. */
  destroy(): void;
}

function createContinuumStore(session: Session): ContinuumStore {
  let snapshot = session.getSnapshot();
  const snapshotListeners = new Set<Listener>();
  const diagnosticsListeners = new Set<Listener>();
  const nodeListeners = new Map<string, Set<Listener>>();

  const cleanupSnapshot = session.onSnapshot((nextSnapshot) => {
    const previousSnapshot = snapshot;
    snapshot = nextSnapshot;

    notifyListeners(snapshotListeners);
    notifyListeners(diagnosticsListeners);

    if (!previousSnapshot || !nextSnapshot) {
      for (const listeners of nodeListeners.values()) {
        notifyListeners(listeners);
      }
      return;
    }

    const changedIds = getChangedNodeIds(previousSnapshot, nextSnapshot);
    for (const id of changedIds) {
      const listeners = nodeListeners.get(id);
      if (listeners) {
        notifyListeners(listeners);
      }
    }
  });

  const cleanupIssues = session.onIssues(() => {
    notifyListeners(diagnosticsListeners);
  });

  return {
    getSnapshot: () => snapshot,
    subscribeSnapshot(listener) {
      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribeDiagnostics(listener) {
      diagnosticsListeners.add(listener);
      return () => {
        diagnosticsListeners.delete(listener);
      };
    },
    getNodeValue(nodeId) {
      return snapshot?.data.values?.[nodeId] as NodeValue | undefined;
    },
    getNodeViewport(nodeId) {
      return snapshot?.data.viewContext?.[nodeId];
    },
    subscribeNode(nodeId, listener) {
      const existing = nodeListeners.get(nodeId);
      if (existing) {
        existing.add(listener);
      } else {
        nodeListeners.set(nodeId, new Set([listener]));
      }

      return () => {
        const listeners = nodeListeners.get(nodeId);
        if (!listeners) {
          return;
        }
        listeners.delete(listener);
        if (listeners.size === 0) {
          nodeListeners.delete(nodeId);
        }
      };
    },
    destroy() {
      cleanupSnapshot();
      cleanupIssues();
      snapshotListeners.clear();
      diagnosticsListeners.clear();
      nodeListeners.clear();
    },
  };
}

/**
 * Value shape exposed through `ContinuumContext`.
 */
export interface ContinuumContextValue {
  /** Backing Continuum session instance. */
  session: Session;
  /** Subscription-friendly store facade over session state. */
  store: ContinuumStore;
  /** Resolved node type to component map. */
  componentMap: ContinuumNodeMap;
  /** True when provider loaded from existing persisted state. */
  wasHydrated: boolean;
}

/**
 * React context backing all `@continuum/react` hooks and renderer behavior.
 */
export const ContinuumContext = createContext<ContinuumContextValue | null>(null);

const DEFAULT_STORAGE_KEY = 'continuum_session';

function resolveStorage(
  persist: ContinuumProviderProps['persist']
): Storage | undefined {
  if (persist === 'sessionStorage') return globalThis.sessionStorage;
  if (persist === 'localStorage') return globalThis.localStorage;
  return undefined;
}

function mapsMatch(
  left: ContinuumNodeMap,
  right: ContinuumNodeMap
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (let index = 0; index < rightKeys.length; index += 1) {
    const key = rightKeys[index];
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

function useStableMap(map: ContinuumNodeMap): ContinuumNodeMap {
  const ref = useRef(map);
  if (mapsMatch(ref.current, map)) {
    return ref.current;
  }
  ref.current = map;
  return map;
}

/**
 * Initializes and provides Continuum session context to the React subtree.
 *
 * Creates (or hydrates) a session once, wires optional persistence, and
 * provides a reactive store used by hooks and renderer components.
 */
export function ContinuumProvider({
  components,
  persist = false,
  storageKey = DEFAULT_STORAGE_KEY,
  maxPersistBytes,
  onPersistError,
  sessionOptions,
  children,
}: ContinuumProviderProps) {
  const storage = resolveStorage(persist);
  const stableComponents = useStableMap(components);
  const sessionRef = useRef<{
    session: Session;
    store: ContinuumStore;
    wasHydrated: boolean;
  } | null>(null);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!sessionRef.current) {
    const wasHydrated = Boolean(storage?.getItem(storageKey));
    const session = hydrateOrCreate({
      ...sessionOptions,
      persistence: storage
        ? {
          storage,
          key: storageKey,
          maxBytes: maxPersistBytes,
          onError: onPersistError ?? ((error) => {
            console.warn('Continuum persistence error', error);
          }),
        }
        : undefined,
    });
    const store = createContinuumStore(session);
    sessionRef.current = { session, store, wasHydrated };
  }

  const { session, store, wasHydrated } = sessionRef.current;
  useEffect(() => {
    if (destroyTimerRef.current) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }
    return () => {
      destroyTimerRef.current = setTimeout(() => {
        store.destroy();
        session.destroy();
        destroyTimerRef.current = null;
      }, 0);
    };
  }, [session, store]);

  const value = useMemo<ContinuumContextValue>(
    () => ({ session, store, componentMap: stableComponents, wasHydrated }),
    [session, store, stableComponents, wasHydrated]
  );

  return (
    <ContinuumContext.Provider value={value}>
      {children}
    </ContinuumContext.Provider>
  );
}
