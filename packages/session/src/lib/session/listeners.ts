import type { ContinuitySnapshot } from '@continuum/contract';
import type { ReconciliationIssue } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

/**
 * Builds a continuity snapshot from internal view/data state.
 *
 * @param internal Mutable internal session state.
 * @returns Snapshot when both view and data are present, otherwise null.
 */
export function buildSnapshotFromCurrentState(internal: SessionState): ContinuitySnapshot | null {
  if (!internal.currentView || !internal.currentData) return null;
  return { view: internal.currentView, data: internal.currentData };
}

/**
 * Notifies all snapshot listeners with the latest snapshot value.
 *
 * Listener exceptions are swallowed so one faulty subscriber cannot block others.
 *
 * @param internal Mutable internal session state.
 */
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

/**
 * Notifies all issue listeners with a cloned issue array.
 *
 * Listener exceptions are swallowed so one faulty subscriber cannot block others.
 *
 * @param internal Mutable internal session state.
 */
export function notifyIssueListeners(internal: SessionState): void {
  for (const listener of internal.issueListeners) {
    try {
      listener([...internal.issues]);
    } catch {
      continue;
    }
  }
}

/**
 * Notifies snapshot listeners, then issue listeners.
 *
 * @param internal Mutable internal session state.
 */
export function notifySnapshotAndIssueListeners(internal: SessionState): void {
  notifySnapshotListeners(internal);
  notifyIssueListeners(internal);
}

/**
 * Registers a snapshot listener.
 *
 * @param internal Mutable internal session state.
 * @param listener Snapshot callback.
 * @returns Unsubscribe function.
 */
export function subscribeSnapshot(
  internal: SessionState,
  listener: (snapshot: ContinuitySnapshot | null) => void
): () => void {
  internal.snapshotListeners.add(listener);
  return () => { internal.snapshotListeners.delete(listener); };
}

/**
 * Registers an issue listener.
 *
 * @param internal Mutable internal session state.
 * @param listener Issues callback.
 * @returns Unsubscribe function.
 */
export function subscribeIssues(
  internal: SessionState,
  listener: (issues: ReconciliationIssue[]) => void
): () => void {
  internal.issueListeners.add(listener);
  return () => { internal.issueListeners.delete(listener); };
}
