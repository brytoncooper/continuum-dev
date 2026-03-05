import type { DataSnapshot, DetachedValue, NodeValue, ViewDefinition } from '@continuum/contract';
import { DATA_RESOLUTIONS } from '@continuum/contract';
import type { NodeResolutionAccumulator, ReconciliationOptions, ReconciliationResult, StateDiff } from './types.js';
import type { ReconciliationContext } from './context.js';
import { buildReconciliationContext, buildPriorValueLookupByIdAndKey } from './context.js';
import { buildFreshSessionResult, buildBlindCarryResult, assembleReconciliationResult } from './reconciliation/state-builder.js';
import { resolveAllNodes, detectRemovedNodes } from './reconciliation/node-resolver.js';
import { restoredDiff, restoredResolution } from './reconciliation/differ.js';

/**
 * Reconciles user state across view mutations produced by AI or server-side layout changes.
 *
 * This is the main runtime entrypoint. Provide the new view plus optional prior view/data,
 * and the runtime returns a deterministic result with merged state, diffs, issue diagnostics,
 * and per-node resolutions.
 *
 * @param newView Current view definition to reconcile into.
 * @param priorView Previous view definition. Pass null for first render or unknown history.
 * @param priorData Previous data snapshot. Pass null for fresh sessions.
 * @param options Optional reconciliation behavior flags and migration extension hooks.
 * @returns The reconciled state and reconciliation metadata for this transition.
 */
export function reconcile(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options: ReconciliationOptions = {}
): ReconciliationResult {
  const now = (options.clock ?? Date.now)();

  if (!priorData) {
    return buildFreshSessionResult(newView, now);
  }

  if (!priorView) {
    return buildBlindCarryResult(newView, priorData, now, options);
  }

  return reconcileViewTransition(newView, priorView, priorData, now, options);
}

/**
 * After resolving new nodes and detecting removals, check whether any nodes
 * resolved as "added" (no prior match) can be restored from values that were
 * just detached in the same push. This closes the gap where renaming both
 * a node's ID and key in a single pushView would lose data until the next push.
 */
function restoreFromSamePushDetachments(
  resolved: NodeResolutionAccumulator,
  removals: { diffs: StateDiff[]; detachedValues?: Record<string, DetachedValue> },
  ctx: ReconciliationContext
): void {
  const justDetached = removals.detachedValues;
  if (!justDetached || Object.keys(justDetached).length === 0) {
    return;
  }

  for (let i = 0; i < resolved.resolutions.length; i++) {
    const resolution = resolved.resolutions[i];
    if (resolution.resolution !== DATA_RESOLUTIONS.ADDED) {
      continue;
    }

    const nodeId = resolution.nodeId;
    if (resolved.values[nodeId] !== undefined) {
      continue;
    }

    const newNode = ctx.newById.get(nodeId);
    if (!newNode) {
      continue;
    }

    const detachedKey = newNode.key ?? nodeId;
    const detachedEntry = justDetached[detachedKey];
    if (!detachedEntry) {
      continue;
    }

    if (detachedEntry.previousNodeType !== newNode.type) {
      continue;
    }

    resolved.values[nodeId] = detachedEntry.value as NodeValue;
    resolved.restoredDetachedKeys.add(detachedKey);

    resolved.diffs.push(restoredDiff(nodeId, detachedEntry.value));
    resolved.resolutions[i] = restoredResolution(nodeId, newNode.type, detachedEntry.value);
  }
}

function reconcileViewTransition(
  newView: ViewDefinition,
  priorView: ViewDefinition,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): ReconciliationResult {
  const ctx = buildReconciliationContext(newView, priorView);
  const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);
  const resolved = resolveAllNodes(ctx, priorValues, priorData, now, options);
  const removals = detectRemovedNodes(ctx, priorData, options, now);
  restoreFromSamePushDetachments(resolved, removals, ctx);
  const result = assembleReconciliationResult(resolved, removals, priorData, newView, now);
  result.issues.unshift(...ctx.issues);
  return result;
}
