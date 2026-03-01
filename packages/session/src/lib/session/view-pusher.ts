import type { ViewDefinition } from '@continuum/contract';
import { reconcile } from '@continuum/runtime';
import type { SessionState } from './session-state.js';
import { autoCheckpoint } from './checkpoint-manager.js';
import { markAllPendingIntentsAsStale } from './intent-manager.js';
import { notifySnapshotAndIssueListeners } from './listeners.js';

function assertValidView(view: ViewDefinition): void {
  if (typeof view.viewId !== 'string' || view.viewId.length === 0) {
    throw new Error('Invalid view: "viewId" must be a non-empty string');
  }
  if (typeof view.version !== 'string' || view.version.length === 0) {
    throw new Error('Invalid view: "version" must be a non-empty string');
  }
  if (!Array.isArray(view.nodes)) {
    throw new Error('Invalid view: "nodes" must be an array');
  }
}

export function pushView(internal: SessionState, view: ViewDefinition): void {
  if (internal.destroyed) return;
  assertValidView(view);

  const priorVersion = internal.currentView?.version;
  internal.priorView = internal.currentView;
  internal.currentView = view;

  const result = reconcile(
    view,
    internal.priorView,
    internal.currentData,
    { clock: internal.clock, ...(internal.reconciliationOptions ?? {}) }
  );

  internal.currentData = {
    ...result.reconciledState,
    lineage: {
      ...result.reconciledState.lineage,
      sessionId: internal.sessionId,
    },
  };
  internal.issues = result.issues;
  internal.diffs = result.diffs;
  internal.resolutions = result.resolutions;

  if (priorVersion && priorVersion !== view.version) {
    markAllPendingIntentsAsStale(internal);
  }

  autoCheckpoint(internal);
  notifySnapshotAndIssueListeners(internal);
}
