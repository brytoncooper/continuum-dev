import type { ReconciliationIssue } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

export function teardownSessionAndClearState(internal: SessionState): { issues: ReconciliationIssue[] } {
  internal.destroyed = true;
  internal.currentSchema = null;
  internal.currentState = null;
  internal.priorSchema = null;
  internal.eventLog = [];
  internal.pendingActions = [];
  const result = { issues: [...internal.issues] };
  internal.issues = [];
  internal.snapshotListeners.clear();
  internal.issueListeners.clear();
  return result;
}
