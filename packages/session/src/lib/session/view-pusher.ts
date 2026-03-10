import type {
  DataSnapshot,
  ViewDefinition,
  DetachedValue,
  NodeValue,
} from '@continuum-dev/contract';
import { reconcile } from '@continuum-dev/runtime';
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
    internal.currentData = {
      ...internal.currentData!,
      detachedValues: updated,
    };
  }
}

function isCollectionState(
  value: unknown
): value is { items: Array<{ values?: Record<string, unknown> }> } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { items?: unknown };
  return Array.isArray(candidate.items);
}

function isPopulatedValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  return true;
}

function stripSuggestionsFromNodeValue(nodeValue: NodeValue): NodeValue {
  const next = structuredClone(nodeValue) as NodeValue & {
    value: unknown;
    suggestion?: unknown;
  };
  delete next.suggestion;

  const walkCollectionState = (state: unknown): void => {
    if (!isCollectionState(state)) {
      return;
    }

    for (const item of state.items) {
      if (!item || typeof item !== 'object' || !item.values) {
        continue;
      }

      const values = item.values;
      for (const key of Object.keys(values)) {
        const nested = values[key];
        if (nested && typeof nested === 'object' && 'value' in nested) {
          values[key] = stripSuggestionsFromNodeValue(nested as NodeValue);
        }
      }
    }
  };

  walkCollectionState(next.value);
  return next;
}

function lockPopulatedValuesAsDirty(nodeValue: NodeValue): NodeValue {
  const next = structuredClone(nodeValue) as NodeValue & {
    value: unknown;
    isSticky?: boolean;
  };

  const walkCollectionState = (state: unknown): void => {
    if (!isCollectionState(state)) {
      return;
    }

    for (const item of state.items) {
      if (!item || typeof item !== 'object' || !item.values) {
        continue;
      }

      const values = item.values;
      for (const key of Object.keys(values)) {
        const nested = values[key];
        if (nested && typeof nested === 'object' && 'value' in nested) {
          values[key] = lockPopulatedValuesAsDirty(nested as NodeValue);
        }
      }
    }
  };

  if (isCollectionState(next.value)) {
    walkCollectionState(next.value);
    return next;
  }

  if (
    next.isDirty !== true &&
    next.isSticky !== true &&
    isPopulatedValue(next.value)
  ) {
    next.isSticky = true;
  }

  return next;
}

function stripSuggestionsForReconcile(priorData: DataSnapshot): DataSnapshot {
  const sanitizedValues: Record<string, NodeValue> = {};

  for (const [nodeId, nodeValue] of Object.entries(priorData.values)) {
    sanitizedValues[nodeId] = lockPopulatedValuesAsDirty(
      stripSuggestionsFromNodeValue(nodeValue)
    );
  }

  const sanitizedDetachedValues: Record<string, DetachedValue> = {};
  const detachedValues = priorData.detachedValues ?? {};
  for (const [key, detached] of Object.entries(detachedValues)) {
    const detachedValue =
      detached.value &&
      typeof detached.value === 'object' &&
      'value' in (detached.value as Record<string, unknown>)
        ? stripSuggestionsFromNodeValue(detached.value as NodeValue)
        : detached.value;

    sanitizedDetachedValues[key] = {
      ...detached,
      value: detachedValue,
    };
  }

  return {
    ...priorData,
    values: sanitizedValues,
    ...(Object.keys(sanitizedDetachedValues).length > 0
      ? { detachedValues: sanitizedDetachedValues }
      : {}),
  };
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
  const priorDataForReconcile = internal.currentData
    ? stripSuggestionsForReconcile(internal.currentData)
    : null;

  const result = reconcile(view, internal.priorView, priorDataForReconcile, {
    clock: internal.clock,
    ...(internal.reconciliationOptions ?? {}),
  });

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
