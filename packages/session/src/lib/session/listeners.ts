import type { ContinuitySnapshot } from '@continuum/contract';
import type { ReconciliationIssue } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

export function buildSnapshotFromCurrentState(internal: SessionState): ContinuitySnapshot | null {
  if (!internal.currentView || !internal.currentData) return null;
  return { view: internal.currentView, data: internal.currentData };
}

export function notifySnapshotListeners(internal: SessionState): void {
  const snapshot = buildSnapshotFromCurrentState(internal);
  for (const listener of internal.snapshotListeners) {
    try {
      (listener as (s: ContinuitySnapshot | null) => void)(snapshot);
    } catch {
      continue;
    }
  }
}

export function notifyIssueListeners(internal: SessionState): void {
  for (const listener of internal.issueListeners) {
    try {
      listener([...internal.issues]);
    } catch {
      continue;
    }
  }
}

export function notifySnapshotAndIssueListeners(internal: SessionState): void {
  notifySnapshotListeners(internal);
  notifyIssueListeners(internal);
}

export function subscribeSnapshot(
  internal: SessionState,
  listener: (snapshot: ContinuitySnapshot | null) => void
): () => void {
  internal.snapshotListeners.add(listener);
  return () => { internal.snapshotListeners.delete(listener); };
}

export function subscribeIssues(
  internal: SessionState,
  listener: (issues: ReconciliationIssue[]) => void
): () => void {
  internal.issueListeners.add(listener);
  return () => { internal.issueListeners.delete(listener); };
}
