import { inject, computed, Signal } from '@angular/core';
import type { Session } from '@continuum/session';
import type {
  ContinuitySnapshot,
  NodeValue,
  Checkpoint,
} from '@continuum/contract';
import type {
  ReconciliationIssue,
  StateDiff,
  ReconciliationResolution,
} from '@continuum/runtime';
import {
  CONTIUUM_SESSION,
  CONTIUUM_SNAPSHOT,
  CONTIUUM_WAS_HYDRATED,
} from './tokens.js';

export function injectContinuumSession(): Session {
  const session = inject(CONTIUUM_SESSION);
  if (!session) {
    throw new Error(
      'injectContinuumSession must be used within a provider configured by provideContinuum()'
    );
  }
  return session;
}

export function injectContinuumHydrated(): boolean {
  const wasHydrated = inject(CONTIUUM_WAS_HYDRATED);
  return wasHydrated ?? false;
}

export function injectContinuumSnapshot(): Signal<ContinuitySnapshot | null> {
  return inject(CONTIUUM_SNAPSHOT);
}

export function injectContinuumState(
  nodeId: string
): [Signal<NodeValue | undefined>, (value: NodeValue) => void] {
  const session = injectContinuumSession();
  const snapshot = inject(CONTIUUM_SNAPSHOT);
  const state = computed(() => {
    const snap = snapshot();
    return snap?.data.values?.[nodeId] as NodeValue | undefined;
  });
  const setValue = (value: NodeValue) => {
    session.updateState(nodeId, value);
  };
  return [state, setValue];
}

export function injectContinuumDiagnostics(): Signal<{
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  checkpoints: Checkpoint[];
}> {
  const session = injectContinuumSession();
  const snapshot = inject(CONTIUUM_SNAPSHOT);
  return computed(() => {
    snapshot();
    return {
      issues: session.getIssues(),
      diffs: session.getDiffs(),
      resolutions: session.getResolutions(),
      checkpoints: session.getCheckpoints(),
    };
  });
}
