import type { DetachedValue, ViewDefinition } from '@continuum-dev/contract';
import {
  applyContinuumViewUpdate,
  type AppliedContinuumViewState,
} from '@continuum-dev/runtime';
import type { SessionViewApplyOptions } from '../types.js';
import type { SessionState } from './session-state.js';
import { autoCheckpoint } from './checkpoint-manager.js';
import { markAllPendingIntentsAsStale } from './intent-manager.js';
import { notifySnapshotAndIssueListeners } from './listeners.js';

export type AppliedViewState = AppliedContinuumViewState;

export function runDetachedValueGC(internal: SessionState): void {
  const policy = internal.detachedValuePolicy;
  const detached = internal.currentData?.detachedValues;
  if (!policy || !detached || Object.keys(detached).length === 0) {
    return;
  }

  const now = internal.clock();
  const entries = Object.entries(detached);
  const toRemove = new Set<string>();

  for (const [, value] of entries) {
    value.pushesSinceDetach = (value.pushesSinceDetach ?? 0) + 1;
  }

  if (policy.maxAge !== undefined) {
    for (const [key, value] of entries) {
      if (now - value.detachedAt > policy.maxAge) {
        toRemove.add(key);
      }
    }
  }

  if (policy.pushCount !== undefined) {
    for (const [key, value] of entries) {
      if ((value.pushesSinceDetach ?? 0) >= policy.pushCount) {
        toRemove.add(key);
      }
    }
  }

  if (policy.maxCount !== undefined) {
    const remaining = entries
      .filter(([key]) => !toRemove.has(key))
      .sort(([, a], [, b]) => a.detachedAt - b.detachedAt);
    while (remaining.length > policy.maxCount) {
      const oldest = remaining.shift();
      if (oldest) {
        toRemove.add(oldest[0]);
      }
    }
  }

  if (toRemove.size === 0) {
    return;
  }

  const updated: Record<string, DetachedValue> = {};
  for (const [key, value] of entries) {
    if (!toRemove.has(key)) {
      updated[key] = value;
    }
  }

  if (Object.keys(updated).length === 0) {
    const rest = { ...internal.currentData! };
    delete rest.detachedValues;
    internal.currentData = rest;
  } else {
    internal.currentData = {
      ...internal.currentData!,
      detachedValues: updated,
    };
  }
}

export function reconcileViewUpdate(
  baseView: ViewDefinition | null,
  baseData: SessionState['currentData'],
  nextView: ViewDefinition,
  internal: Pick<
    SessionState,
    | 'clock'
    | 'reconciliationOptions'
    | 'sessionId'
    | 'issues'
    | 'diffs'
    | 'resolutions'
  >,
  options?: {
    affectedNodeIds?: string[];
    incrementalHint?: 'presentation-content';
  }
): AppliedViewState {
  return applyContinuumViewUpdate({
    baseView,
    baseData,
    nextView,
    sessionId: internal.sessionId,
    clock: internal.clock,
    reconciliationOptions: internal.reconciliationOptions,
    affectedNodeIds: options?.affectedNodeIds,
    incrementalHint: options?.incrementalHint,
    priorIssues: internal.issues,
    priorDiffs: internal.diffs,
    priorResolutions: internal.resolutions,
  });
}

export function commitAppliedViewState(
  internal: SessionState,
  applied: AppliedViewState,
  options?: { transient?: boolean; notify?: boolean }
): void {
  const isTransient = options?.transient === true;
  internal.priorView = applied.priorView;
  internal.currentView = applied.view;
  internal.currentData = applied.data;
  internal.issues = applied.issues;
  internal.diffs = applied.diffs;
  internal.resolutions = applied.resolutions;

  if (
    !isTransient &&
    internal.stableViewVersion &&
    internal.stableViewVersion !== applied.view.version
  ) {
    markAllPendingIntentsAsStale(internal);
  }

  if (!isTransient) {
    internal.stableViewVersion = applied.view.version;
    autoCheckpoint(internal);
    runDetachedValueGC(internal);
  }

  if (options?.notify !== false) {
    notifySnapshotAndIssueListeners(internal);
  }
}

export function pushView(
  internal: SessionState,
  view: ViewDefinition,
  options?: SessionViewApplyOptions
): void {
  if (internal.destroyed) {
    return;
  }

  const applied = reconcileViewUpdate(
    internal.currentView,
    internal.currentData,
    view,
    internal
  );

  commitAppliedViewState(internal, applied, {
    transient: options?.transient === true,
  });
}
