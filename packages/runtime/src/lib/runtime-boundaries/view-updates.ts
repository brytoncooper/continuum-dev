import type {
  DataSnapshot,
  DetachedValue,
  NodeValue,
} from '@continuum-dev/contract';
import { normalizeNodeValueProtection } from '@continuum-dev/contract';
import { collectDuplicateIssues } from '../context/index.js';
import { ISSUE_CODES } from '@continuum-dev/protocol';
import { reconcile } from '../reconcile/index.js';
import type {
  ApplyContinuumViewUpdateInput,
  AppliedContinuumViewState,
} from './types.js';
import { patchViewDefinition } from '../view-patch/index.js';
import { sanitizeContinuumDataSnapshot } from './canonical-data.js';
import { resolveNodeLookupEntry } from './node-lookup.js';
import { applyContinuumTransformPlan } from './transform-plans.js';

function isCollectionState(
  value: unknown
): value is { items: Array<{ values?: Record<string, unknown> }> } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { items?: unknown };
  return Array.isArray(candidate.items);
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

function sanitizePriorDataForReconcile(priorData: DataSnapshot): DataSnapshot {
  const canonicalPriorData = sanitizeContinuumDataSnapshot(priorData)!;
  const sanitizedValues: Record<string, NodeValue> = {};

  for (const [nodeId, nodeValue] of Object.entries(canonicalPriorData.values)) {
    sanitizedValues[nodeId] = stripSuggestionsFromNodeValue(nodeValue);
  }

  const sanitizedDetachedValues: Record<string, DetachedValue> = {};
  const detachedValues = canonicalPriorData.detachedValues ?? {};
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

  const sanitized: DataSnapshot = {
    values: sanitizedValues,
    lineage: canonicalPriorData.lineage,
  };

  if (canonicalPriorData.valueLineage) {
    sanitized.valueLineage = canonicalPriorData.valueLineage;
  }

  if (Object.keys(sanitizedDetachedValues).length > 0) {
    sanitized.detachedValues = sanitizedDetachedValues;
  }

  return sanitized;
}

function normalizeSnapshotProtection(data: DataSnapshot): DataSnapshot {
  const normalizedValues: Record<string, NodeValue> = {};
  for (const [nodeId, nodeValue] of Object.entries(data.values)) {
    normalizedValues[nodeId] = normalizeNodeValueProtection(nodeValue);
  }

  const normalized: DataSnapshot = {
    ...data,
    values: normalizedValues,
  };

  if (data.detachedValues) {
    const detachedValues: Record<string, DetachedValue> = {};
    for (const [key, detached] of Object.entries(data.detachedValues)) {
      const detachedValue =
        detached.value &&
        typeof detached.value === 'object' &&
        'value' in (detached.value as Record<string, unknown>)
          ? normalizeNodeValueProtection(detached.value as NodeValue)
          : detached.value;

      detachedValues[key] = {
        ...detached,
        value: detachedValue,
      };
    }
    normalized.detachedValues = detachedValues;
  }

  return normalized;
}

function tryApplyPresentationIncrementalUpdate(
  input: ApplyContinuumViewUpdateInput,
  patchedView: AppliedContinuumViewState['view']
): AppliedContinuumViewState | null {
  const baseData = sanitizeContinuumDataSnapshot(input.baseData);
  if (
    input.incrementalHint !== 'presentation-content' ||
    input.transformPlan?.operations.length ||
    !baseData ||
    !input.baseView ||
    !input.affectedNodeIds ||
    input.affectedNodeIds.length === 0
  ) {
    return null;
  }

  for (const affectedNodeId of input.affectedNodeIds) {
    const priorLookup = resolveNodeLookupEntry(
      input.baseView.nodes,
      affectedNodeId
    );
    const nextLookup = resolveNodeLookupEntry(
      patchedView.nodes,
      affectedNodeId
    );
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
    data: sanitizeContinuumDataSnapshot(
      normalizeSnapshotProtection({
        ...baseData,
        lineage: {
          ...baseData.lineage,
          timestamp: input.clock
            ? input.clock()
            : baseData.lineage.timestamp + 1,
          sessionId: input.sessionId,
          viewId: patchedView.viewId,
          viewVersion: patchedView.version,
        },
      })
    )!,
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

/**
 * Applies a structural view update and re-enters reconcile to preserve canonical data safety.
 */
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

  const result = reconcile({
    newView: patchedView,
    priorView,
    priorData: priorDataForReconcile,
    options: {
      clock: input.clock,
      ...(input.reconciliationOptions ?? {}),
    },
  });

  let data: AppliedContinuumViewState['data'] = sanitizeContinuumDataSnapshot(
    normalizeSnapshotProtection({
      ...result.reconciledState,
      lineage: {
        ...result.reconciledState.lineage,
        sessionId: input.sessionId,
      },
    })
  )!;
  let diffs = result.diffs;
  let resolutions = result.resolutions;
  let issues = result.issues;

  if (
    input.transformPlan &&
    input.transformPlan.operations.length > 0 &&
    priorView &&
    priorDataForReconcile
  ) {
    const transformed = applyContinuumTransformPlan({
      priorView,
      priorData: priorDataForReconcile,
      nextView: patchedView,
      reconciledData: data,
      plan: input.transformPlan,
      diffs,
      resolutions,
    });
    data = transformed.data;
    diffs = transformed.diffs;
    resolutions = transformed.resolutions;
    issues = issues.filter(
      (issue) =>
        !(
          issue.code === ISSUE_CODES.NODE_REMOVED &&
          issue.nodeId &&
          transformed.consumedSourceNodeIds.includes(issue.nodeId)
        )
    );
  }

  return {
    priorView,
    view: patchedView,
    data: sanitizeContinuumDataSnapshot(normalizeSnapshotProtection(data))!,
    issues,
    diffs,
    resolutions,
    strategy: incremental ? 'incremental' : 'full',
  };
}
