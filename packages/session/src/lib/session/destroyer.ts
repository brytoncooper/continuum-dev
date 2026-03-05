import type { ReconciliationIssue } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

/**
 * Destroys a session and clears all mutable state containers.
 *
 * @param internal Mutable internal session state.
 * @returns Final snapshot of issues captured before teardown.
 */
export function teardownSessionAndClearState(internal: SessionState): { issues: ReconciliationIssue[] } {
  internal.destroyed = true;
  internal.currentView = null;
  internal.currentData = null;
  internal.priorView = null;
  internal.eventLog = [];
  internal.pendingIntents = [];
  internal.checkpoints = [];
  const result = { issues: [...internal.issues] };
  internal.issues = [];
  internal.diffs = [];
  internal.resolutions = [];
  internal.snapshotListeners.clear();
  internal.issueListeners.clear();
  return result;
}
