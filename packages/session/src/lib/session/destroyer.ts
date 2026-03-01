import type { ReconciliationIssue } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

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
