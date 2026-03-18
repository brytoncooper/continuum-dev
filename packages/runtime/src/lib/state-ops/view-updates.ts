import type { DataSnapshot, DetachedValue, NodeValue } from '@continuum-dev/contract';
import { collectDuplicateIssues } from '../context/index.js';
import { reconcile } from '../reconcile/index.js';
import type { ApplyContinuumViewUpdateInput, AppliedContinuumViewState } from './types.js';
import { patchViewDefinition } from '../view-patch/index.js';
import { resolveNodeLookupEntry } from './node-lookup.js';

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

function sanitizePriorDataForReconcile(priorData: DataSnapshot): DataSnapshot {
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

function tryApplyPresentationIncrementalUpdate(
  input: ApplyContinuumViewUpdateInput,
  patchedView: AppliedContinuumViewState['view']
): AppliedContinuumViewState | null {
  if (
    input.incrementalHint !== 'presentation-content' ||
    !input.baseData ||
    !input.baseView ||
    !input.affectedNodeIds ||
    input.affectedNodeIds.length === 0
  ) {
    return null;
  }

  for (const affectedNodeId of input.affectedNodeIds) {
    const priorLookup = resolveNodeLookupEntry(input.baseView.nodes, affectedNodeId);
    const nextLookup = resolveNodeLookupEntry(patchedView.nodes, affectedNodeId);
    if (!priorLookup || !nextLookup) {
      return null;
    }
    if (
      priorLookup.node.type !== 'presentation' ||
      nextLookup.node.type !== 'presentation' ||
      priorLookup.canonicalId !== nextLookup.canonicalId
    ) {
      return null;
    }
  }

  return {
    priorView: input.baseView,
    view: patchedView,
    data: {
      ...input.baseData,
      lineage: {
        ...input.baseData.lineage,
        timestamp: input.clock ? input.clock() : input.baseData.lineage.timestamp + 1,
        sessionId: input.sessionId,
        viewId: patchedView.viewId,
        viewVersion: patchedView.version,
      },
    },
    issues: [
      ...(input.priorIssues ?? []),
      ...collectDuplicateIssues(patchedView.nodes),
    ],
    diffs: [...(input.priorDiffs ?? [])],
    resolutions: [...(input.priorResolutions ?? [])],
    strategy: 'incremental',
  };
}

export function assertValidView(view: AppliedContinuumViewState['view']): void {
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

export function applyContinuumViewUpdate(
  input: ApplyContinuumViewUpdateInput
): AppliedContinuumViewState {
  assertValidView(input.nextView);
  const priorView = input.baseView;
  const patchedView = patchViewDefinition(input.baseView, input.nextView);
  const priorDataForReconcile = input.baseData
    ? sanitizePriorDataForReconcile(input.baseData)
    : null;
  const incremental = tryApplyPresentationIncrementalUpdate(input, patchedView);

  const result = reconcile(patchedView, priorView, priorDataForReconcile, {
    clock: input.clock,
    ...(input.reconciliationOptions ?? {}),
  });

  return {
    priorView,
    view: patchedView,
    data: {
      ...result.reconciledState,
      lineage: {
        ...result.reconciledState.lineage,
        sessionId: input.sessionId,
      },
    },
    issues: result.issues,
    diffs: result.diffs,
    resolutions: result.resolutions,
    strategy: incremental ? 'incremental' : 'full',
  };
}
