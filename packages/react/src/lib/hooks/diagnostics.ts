import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { ProposedValue, Session } from '@continuum-dev/core';
import { useRequiredContinuumContext } from './provider.js';
import { shallowArrayEqual } from './shared.js';

/**
 * Subscribes to session diagnostics (`issues`, `diffs`, `resolutions`, checkpoints).
 */
export function useContinuumDiagnostics() {
  const { session, store } = useRequiredContinuumContext(
    'useContinuumDiagnostics'
  );
  const diagnosticsCacheRef = useRef<{
    issues: ReturnType<Session['getIssues']>;
    diffs: ReturnType<Session['getDiffs']>;
    resolutions: ReturnType<Session['getResolutions']>;
    checkpoints: ReturnType<Session['getCheckpoints']>;
  } | null>(null);

  const getSnapshot = useCallback(() => {
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
      shallowArrayEqual(
        cachedDiagnostics.resolutions,
        nextDiagnostics.resolutions
      ) &&
      shallowArrayEqual(
        cachedDiagnostics.checkpoints,
        nextDiagnostics.checkpoints
      )
    ) {
      return cachedDiagnostics;
    }

    diagnosticsCacheRef.current = nextDiagnostics;
    return nextDiagnostics;
  }, [session]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeDiagnostics(onStoreChange),
    [store]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns conflict state and resolution actions for one node.
 *
 * @param nodeId Canonical node id.
 */
export function useContinuumConflict(nodeId: string): {
  hasConflict: boolean;
  proposal: ProposedValue | null;
  accept: () => void;
  reject: () => void;
} {
  const { session, store } = useRequiredContinuumContext(
    'useContinuumConflict'
  );
  const proposalCacheRef = useRef<ProposedValue | null>(null);
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSnapshot(onStoreChange),
    [store]
  );
  const getSnapshot = useCallback(() => {
    const nextProposal = session.getPendingProposals()[nodeId] ?? null;
    const cachedProposal = proposalCacheRef.current;
    if (cachedProposal === nextProposal) {
      return cachedProposal;
    }
    proposalCacheRef.current = nextProposal;
    return nextProposal;
  }, [session, nodeId]);
  const proposal = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const accept = useCallback(() => {
    session.acceptProposal(nodeId);
  }, [session, nodeId]);

  const reject = useCallback(() => {
    session.rejectProposal(nodeId);
  }, [session, nodeId]);

  return {
    hasConflict: proposal !== null,
    proposal,
    accept,
    reject,
  };
}
