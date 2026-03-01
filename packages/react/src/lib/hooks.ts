import { useContext, useCallback, useRef, useSyncExternalStore } from 'react';
import type { Session } from '@continuum/session';
import type { ContinuitySnapshot, NodeValue } from '@continuum/contract';
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
  const session = useContinuumSession();

  const subscribe = useCallback(
    (onStoreChange: () => void) => session.onSnapshot(onStoreChange),
    [session]
  );

  const getSnapshot = useCallback(() => {
    const snap = session.getSnapshot();
    return snap?.data.values?.[nodeId] as NodeValue | undefined;
  }, [session, nodeId]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: NodeValue) => {
      session.updateState(nodeId, next);
    },
    [session, nodeId]
  );

  return [value, setValue];
}

export function useContinuumSnapshot(): ContinuitySnapshot | null {
  const session = useContinuumSession();
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
    (onStoreChange: () => void) => session.onSnapshot(() => onStoreChange()),
    [session]
  );

  const getSnapshot = useCallback(() => {
    const nextSnapshot = session.getSnapshot();
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
  }, [session]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useContinuumDiagnostics() {
  const session = useContinuumSession();
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
    (onStoreChange: () => void) => {
      const unsub1 = session.onSnapshot(() => onStoreChange());
      const unsub2 = session.onIssues(() => onStoreChange());
      return () => {
        unsub1();
        unsub2();
      };
    },
    [session]
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
