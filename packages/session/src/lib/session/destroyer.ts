import type { ReconciliationIssue } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

export function teardownSessionAndClearState(internal: SessionState): { issues: ReconciliationIssue[] } {
  internal.destroyed = true;
  internal.currentSchema = null;
  internal.currentState = null;
  internal.priorSchema = null;
  internal.eventLog = [];
  internal.pendingActions = [];
  internal.checkpoints = [];
  const result = { issues: [...internal.issues] };
  internal.issues = [];
  internal.diffs = [];
  internal.trace = [];
  internal.snapshotListeners.clear();
  internal.issueListeners.clear();
  return result;
}
