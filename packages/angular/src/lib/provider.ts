import { Provider, signal } from '@angular/core';
import { hydrateOrCreate } from '@continuum-dev/session';
import type { ContinuitySnapshot } from '@continuum-dev/contract';
import type {
  ContinuumPersistError,
  ContinuumProviderOptions,
} from './types.js';
import {
  CONTINUUM_NODE_MAP,
  CONTINUUM_SESSION,
  CONTINUUM_SNAPSHOT,
  CONTINUUM_WAS_HYDRATED,
} from './tokens.js';

const DEFAULT_STORAGE_KEY = 'continuum_session';

function emitPersistError(
  onPersistError: ((error: ContinuumPersistError) => void) | undefined,
  error: ContinuumPersistError
): void {
  if (onPersistError) {
    onPersistError(error);
    return;
  }
  console.warn('Continuum persistence error', error);
}

function resolveStorage(
  persist: ContinuumProviderOptions['persist']
): Storage | undefined {
  if (persist === 'sessionStorage') return globalThis.sessionStorage;
  if (persist === 'localStorage') return globalThis.localStorage;
  return undefined;
}

export function provideContinuum(
  options: ContinuumProviderOptions
): Provider[] {
  const storage = resolveStorage(options.persist);
  const key = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const wasHydrated = Boolean(storage?.getItem(key));
  const session = hydrateOrCreate({
    ...options.sessionOptions,
    persistence: storage
      ? {
          storage,
          key,
          maxBytes: options.maxPersistBytes,
          onError:
            options.onPersistError ??
            ((error: ContinuumPersistError) => {
              emitPersistError(undefined, error);
            }),
        }
      : undefined,
  });

  const snapshotSignal = signal<ContinuitySnapshot | null>(
    session.getSnapshot()
  );
  session.onSnapshot(() => {
    snapshotSignal.set(session.getSnapshot());
  });

  return [
    { provide: CONTINUUM_SESSION, useValue: session },
    { provide: CONTINUUM_SNAPSHOT, useValue: snapshotSignal },
    { provide: CONTINUUM_NODE_MAP, useValue: options.components },
    { provide: CONTINUUM_WAS_HYDRATED, useValue: wasHydrated },
  ];
}
