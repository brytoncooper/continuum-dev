import type { DataSnapshot, ViewDefinition } from '@continuum-dev/contract';
import {
  buildPriorValueLookupByIdAndKey,
  buildReconciliationContext,
} from '../context/index.js';
import type {
  ReconciliationOptions,
  ReconciliationResult,
} from '../types.js';
import { resolveAllNodes, detectRemovedNodes } from '../reconciliation/node-resolver/index.js';
import { assembleReconciliationResult } from '../reconciliation/result-builder/index.js';
import { applySemanticKeyMoves } from './semantic-key-moves.js';
import { restoreFromSamePushDetachments } from './same-push-restore.js';

export function reconcileViewTransition(
  newView: ViewDefinition,
  priorView: ViewDefinition,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): ReconciliationResult {
  const context = buildReconciliationContext(newView, priorView);
  const priorValues = buildPriorValueLookupByIdAndKey(priorData, context);
  const resolved = resolveAllNodes(context, priorValues, priorData, now, options);
  const removals = detectRemovedNodes(context, priorData, options, now);

  restoreFromSamePushDetachments(resolved, removals, context);
  applySemanticKeyMoves(context, priorData, resolved);

  const result = assembleReconciliationResult(
    resolved,
    removals,
    priorData,
    newView,
    now
  );
  result.issues.unshift(...context.issues);
  return result;
}
