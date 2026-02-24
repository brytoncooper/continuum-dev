import { useContext, useCallback, useRef, useSyncExternalStore } from 'react';
import type { Session } from '@continuum/session';
import type { ContinuitySnapshot, ComponentState } from '@continuum/contract';
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
  componentId: string
): [ComponentState | undefined, (value: ComponentState) => void] {
  const session = useContinuumSession();

  const subscribe = useCallback(
    (onStoreChange: () => void) => session.onSnapshot(onStoreChange),
    [session]
  );

  const getSnapshot = useCallback(() => {
    const snap = session.getSnapshot();
    return snap?.state.values?.[componentId] as ComponentState | undefined;
  }, [session, componentId]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: ComponentState) => {
      session.updateState(componentId, next);
    },
    [session, componentId]
  );

  return [value, setValue];
}

export function useContinuumSnapshot(): ContinuitySnapshot | null {
  const session = useContinuumSession();
  const snapshotCacheRef = useRef<{
    schema: ContinuitySnapshot['schema'] | null;
    state: ContinuitySnapshot['state'] | null;
    snapshot: ContinuitySnapshot | null;
  }>({
    schema: null,
    state: null,
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
      cache.schema = null;
      cache.state = null;
      cache.snapshot = null;
      return null;
    }

    if (
      cache.snapshot &&
      cache.schema === nextSnapshot.schema &&
      cache.state === nextSnapshot.state
    ) {
      return cache.snapshot;
    }

    cache.schema = nextSnapshot.schema;
    cache.state = nextSnapshot.state;
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
    trace: ReturnType<Session['getTrace']>;
    checkpoints: ReturnType<Session['getCheckpoints']>;
  } | null>(null);

  const getSnapshot = useCallback(
    () => {
      const nextDiagnostics = {
        issues: session.getIssues(),
        diffs: session.getDiffs(),
        trace: session.getTrace(),
        checkpoints: session.getCheckpoints(),
      };
      const cachedDiagnostics = diagnosticsCacheRef.current;

      if (
        cachedDiagnostics &&
        shallowArrayEqual(cachedDiagnostics.issues, nextDiagnostics.issues) &&
        shallowArrayEqual(cachedDiagnostics.diffs, nextDiagnostics.diffs) &&
        shallowArrayEqual(cachedDiagnostics.trace, nextDiagnostics.trace) &&
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
