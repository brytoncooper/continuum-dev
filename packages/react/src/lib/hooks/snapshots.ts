import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { ContinuitySnapshot } from '@continuum-dev/core';
import { useRequiredContinuumContext } from './provider.js';

interface ContinuitySnapshotCache {
  view: ContinuitySnapshot['view'] | null;
  data: ContinuitySnapshot['data'] | null;
  snapshot: ContinuitySnapshot | null;
}

function createSnapshotCache(): ContinuitySnapshotCache {
  return {
    view: null,
    data: null,
    snapshot: null,
  };
}

function readStableSnapshot(
  cache: ContinuitySnapshotCache,
  nextSnapshot: ContinuitySnapshot | null
): ContinuitySnapshot | null {
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
}

/**
 * Subscribes to the full continuity snapshot.
 */
export function useContinuumSnapshot(): ContinuitySnapshot | null {
  const { store } = useRequiredContinuumContext('useContinuumSnapshot');
  const snapshotCacheRef = useRef<ContinuitySnapshotCache>(
    createSnapshotCache()
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSnapshot(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(
    () => readStableSnapshot(snapshotCacheRef.current, store.getSnapshot()),
    [store]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribes to the latest durable committed continuity snapshot.
 */
export function useContinuumCommittedSnapshot(): ContinuitySnapshot | null {
  const { store } = useRequiredContinuumContext(
    'useContinuumCommittedSnapshot'
  );
  const snapshotCacheRef = useRef<ContinuitySnapshotCache>(
    createSnapshotCache()
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSnapshot(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(
    () =>
      readStableSnapshot(
        snapshotCacheRef.current,
        store.getCommittedSnapshot()
      ),
    [store]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
