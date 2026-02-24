import type { ContinuitySnapshot } from '@continuum/contract';
import type { ReconciliationIssue } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

export function buildSnapshotFromCurrentState(internal: SessionState): ContinuitySnapshot | null {
  if (!internal.currentSchema || !internal.currentState) return null;
  return { schema: internal.currentSchema, state: internal.currentState };
}

export function notifySnapshotListeners(internal: SessionState): void {
  const snapshot = buildSnapshotFromCurrentState(internal);
  if (!snapshot) return;
  for (const listener of internal.snapshotListeners) {
    listener(snapshot);
  }
}

export function notifyIssueListeners(internal: SessionState): void {
  for (const listener of internal.issueListeners) {
    listener([...internal.issues]);
  }
}

export function notifySnapshotAndIssueListeners(internal: SessionState): void {
  notifySnapshotListeners(internal);
  notifyIssueListeners(internal);
}

export function subscribeSnapshot(
  internal: SessionState,
  listener: (snapshot: ContinuitySnapshot) => void
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
