import { useContext, useCallback, useSyncExternalStore } from 'react';
import type { Session } from '@continuum/session';
import type { ComponentState } from '@continuum/contract';
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
