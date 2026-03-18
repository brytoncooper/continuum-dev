import { useEffect, useMemo, useRef } from 'react';
import { hydrateOrCreate } from '@continuum-dev/core';
import type { Session } from '@continuum-dev/core';
import type { ContinuumNodeMap, ContinuumProviderProps } from '../types.js';
import { ContinuumContext, type ContinuumContextValue } from './render-contexts.js';
import { createContinuumStore, type ContinuumStore } from './store.js';

const DEFAULT_STORAGE_KEY = 'continuum_session';

function resolveStorage(
  persist: ContinuumProviderProps['persist']
): Storage | undefined {
  if (persist === 'sessionStorage') {
    return globalThis.sessionStorage;
  }
  if (persist === 'localStorage') {
    return globalThis.localStorage;
  }
  return undefined;
}

function mapsMatch(left: ContinuumNodeMap, right: ContinuumNodeMap): boolean {
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
            onError:
              onPersistError ??
              ((error) => {
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
