import { Provider, signal } from '@angular/core';
import { createSession, deserialize } from '@continuum/session';
import type { Session } from '@continuum/session';
import type { ContinuitySnapshot } from '@continuum/contract';
import type { ContinuumProviderOptions } from './types.js';
import {
  CONTIUUM_NODE_MAP,
  CONTIUUM_SESSION,
  CONTIUUM_SNAPSHOT,
  CONTIUUM_WAS_HYDRATED,
} from './tokens.js';

const DEFAULT_STORAGE_KEY = 'continuum_session';

function resolveStorage(
  persist: ContinuumProviderOptions['persist']
): Storage | null {
  if (!persist) return null;
  if (persist === 'sessionStorage') return globalThis.sessionStorage;
  if (persist === 'localStorage') return globalThis.localStorage;
  return null;
}

function hydrateOrCreate(
  storage: Storage | null,
  key: string,
  sessionOptions: ContinuumProviderOptions['sessionOptions']
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

export function provideContinuum(options: ContinuumProviderOptions): Provider[] {
  const storage = resolveStorage(options.persist);
  const key = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const { session, wasHydrated } = hydrateOrCreate(
    storage,
    key,
    options.sessionOptions
  );

  const snapshotSignal = signal<ContinuitySnapshot | null>(session.getSnapshot());
  session.onSnapshot(() => {
    snapshotSignal.set(session.getSnapshot());
  });

  if (storage) {
    session.onSnapshot(() => {
      const serialized = session.serialize();
      storage.setItem(key, JSON.stringify(serialized));
    });
  }

  return [
    { provide: CONTIUUM_SESSION, useValue: session },
    { provide: CONTIUUM_SNAPSHOT, useValue: snapshotSignal },
    { provide: CONTIUUM_NODE_MAP, useValue: options.components },
    { provide: CONTIUUM_WAS_HYDRATED, useValue: wasHydrated },
  ];
}
