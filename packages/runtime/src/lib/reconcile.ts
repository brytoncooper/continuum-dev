import type { DataSnapshot, ViewDefinition } from '@continuum/contract';
import type { ReconciliationOptions, ReconciliationResult } from './types.js';
import { buildReconciliationContext, buildPriorValueLookupByIdAndKey } from './context.js';
import { buildFreshSessionResult, buildBlindCarryResult, assembleReconciliationResult } from './reconciliation/state-builder.js';
import { resolveAllNodes, detectRemovedNodes } from './reconciliation/node-resolver.js';

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
  return assembleReconciliationResult(resolved, removals, priorData, newView, now);
}
