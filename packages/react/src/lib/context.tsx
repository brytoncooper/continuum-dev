import { createContext, useRef, useMemo, useEffect } from 'react';
import { createSession, deserialize } from '@continuum/session';
import type { Session } from '@continuum/session';
import type { ContinuumComponentMap, ContinuumProviderProps } from './types.js';
import { usePersistence } from './persistence.js';

export interface ContinuumContextValue {
  session: Session;
  componentMap: ContinuumComponentMap;
  wasHydrated: boolean;
}

export const ContinuumContext = createContext<ContinuumContextValue | null>(null);

const DEFAULT_STORAGE_KEY = 'continuum_session';

function resolveStorage(
  persist: ContinuumProviderProps['persist']
): Storage | null {
  if (!persist) return null;
  if (persist === 'sessionStorage') return globalThis.sessionStorage;
  if (persist === 'localStorage') return globalThis.localStorage;
  return null;
}

function hydrateOrCreate(
  storage: Storage | null,
  key: string,
  sessionOptions: ContinuumProviderProps['sessionOptions']
): { session: Session; wasHydrated: boolean } {
  if (storage) {
    const raw = storage.getItem(key);
    if (raw) {
      try {
        return {
          session: deserialize(JSON.parse(raw), sessionOptions),
          wasHydrated: true,
        };
      } catch {
        storage.removeItem(key);
      }
    }
  }
  return { session: createSession(sessionOptions), wasHydrated: false };
}

export function ContinuumProvider({
  components,
  persist = false,
  storageKey = DEFAULT_STORAGE_KEY,
  sessionOptions,
  children,
}: ContinuumProviderProps) {
  const storage = resolveStorage(persist);
  const sessionRef = useRef<{ session: Session; wasHydrated: boolean } | null>(null);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = hydrateOrCreate(storage, storageKey, sessionOptions);
  }

  const { session, wasHydrated } = sessionRef.current;

  usePersistence(session, storage, storageKey);
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
