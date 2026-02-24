import { useContext, useCallback, useState, useEffect, useSyncExternalStore } from 'react';
import type { Session } from '@continuum/session';
import type { ContinuitySnapshot, ComponentState } from '@continuum/contract';
import { ContinuumContext } from './context.js';

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
  const [snapshot, setSnapshot] = useState<ContinuitySnapshot | null>(
    () => session.getSnapshot()
  );

  useEffect(() => {
    setSnapshot(session.getSnapshot());
    return session.onSnapshot(setSnapshot);
  }, [session]);

  return snapshot;
}

export function useContinuumDiagnostics() {
  const session = useContinuumSession();

  const read = useCallback(
    () => ({
      issues: session.getIssues(),
      diffs: session.getDiffs(),
      trace: session.getTrace(),
      checkpoints: session.getCheckpoints(),
    }),
    [session]
  );

  const [state, setState] = useState(read);

  useEffect(() => {
    setState(read());
    const refresh = () => setState(read());
    const unsub1 = session.onSnapshot(refresh);
    const unsub2 = session.onIssues(refresh);
    return () => {
      unsub1();
      unsub2();
    };
  }, [session, read]);

  return state;
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
