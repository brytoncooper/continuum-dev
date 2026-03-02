import { createContext, useRef, useMemo, useEffect } from 'react';
import { hydrateOrCreate } from '@continuum/session';
import type { Session } from '@continuum/session';
import type { ContinuumNodeMap, ContinuumProviderProps } from './types.js';

export interface ContinuumContextValue {
  session: Session;
  componentMap: ContinuumNodeMap;
  wasHydrated: boolean;
}

export const ContinuumContext = createContext<ContinuumContextValue | null>(null);

const DEFAULT_STORAGE_KEY = 'continuum_session';

function resolveStorage(
  persist: ContinuumProviderProps['persist']
): Storage | undefined {
  if (persist === 'sessionStorage') return globalThis.sessionStorage;
  if (persist === 'localStorage') return globalThis.localStorage;
  return undefined;
}

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
  const sessionRef = useRef<{ session: Session; wasHydrated: boolean } | null>(null);
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
    sessionRef.current = { session, wasHydrated };
  }

  const { session, wasHydrated } = sessionRef.current;
  useEffect(() => {
    if (destroyTimerRef.current) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }
    return () => {
      destroyTimerRef.current = setTimeout(() => {
        session.destroy();
        destroyTimerRef.current = null;
      }, 0);
    };
  }, [session]);

  const value = useMemo<ContinuumContextValue>(
    () => ({ session, componentMap: components, wasHydrated }),
    [session, components, wasHydrated]
  );

  return (
    <ContinuumContext.Provider value={value}>
      {children}
    </ContinuumContext.Provider>
  );
}
