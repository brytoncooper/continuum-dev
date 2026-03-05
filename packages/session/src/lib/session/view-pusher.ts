import type { ViewDefinition, DetachedValue } from '@continuum/contract';
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

function runDetachedValueGC(internal: SessionState): void {
  const policy = internal.detachedValuePolicy;
  const detached = internal.currentData?.detachedValues;
  if (!policy || !detached || Object.keys(detached).length === 0) {
    return;
  }

  const now = internal.clock();
  const entries = Object.entries(detached);
  const toRemove = new Set<string>();

  // Increment pushesSinceDetach for all entries
  for (const [, value] of entries) {
    value.pushesSinceDetach = (value.pushesSinceDetach ?? 0) + 1;
  }

  // Strategy: maxAge
  if (policy.maxAge !== undefined) {
    for (const [key, value] of entries) {
      if (now - value.detachedAt > policy.maxAge) {
        toRemove.add(key);
      }
    }
  }

  // Strategy: pushCount
  if (policy.pushCount !== undefined) {
    for (const [key, value] of entries) {
      if ((value.pushesSinceDetach ?? 0) >= policy.pushCount) {
        toRemove.add(key);
      }
    }
  }

  // Strategy: maxCount (FIFO — oldest first)
  if (policy.maxCount !== undefined) {
    const remaining = entries
      .filter(([key]) => !toRemove.has(key))
      .sort(([, a], [, b]) => a.detachedAt - b.detachedAt);
    while (remaining.length > policy.maxCount) {
      const oldest = remaining.shift()!;
      toRemove.add(oldest[0]);
    }
  }

  if (toRemove.size === 0) return;

  const updated: Record<string, DetachedValue> = {};
  for (const [key, value] of entries) {
    if (!toRemove.has(key)) {
      updated[key] = value;
    }
  }

  if (Object.keys(updated).length === 0) {
    const { detachedValues: _, ...rest } = internal.currentData!;
    internal.currentData = rest;
  } else {
    internal.currentData = { ...internal.currentData!, detachedValues: updated };
  }
}

/**
 * Pushes a new view definition into the session and reconciles existing data.
 *
 * Updates reconciliation artifacts, marks stale pending intents when view version
 * changes, creates an auto checkpoint, runs detached-value GC, and notifies listeners.
 *
 * @param internal Mutable internal session state.
 * @param view Next view definition to apply.
 */
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
  runDetachedValueGC(internal);
  notifySnapshotAndIssueListeners(internal);
}
