import type {
  DataSnapshot,
  ViewDefinition,
} from '@continuum-dev/contract';
import type {
  ReconciliationOptions,
  ReconciliationResult,
} from '../types.js';
import {
  buildBlindCarryResult,
  buildFreshSessionResult,
} from '../reconciliation/result-builder/index.js';
import { resolveReconciliationTimestamp } from './time.js';
import { reconcileViewTransition } from './transition.js';

export function reconcile(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options: ReconciliationOptions
): ReconciliationResult {
  const now = resolveReconciliationTimestamp(priorData, options);

  if (!priorData) {
    return buildFreshSessionResult(newView, now);
  }

  if (!priorView) {
    return buildBlindCarryResult(newView, priorData, now, options);
  }

  return reconcileViewTransition(newView, priorView, priorData, now, options);
}
