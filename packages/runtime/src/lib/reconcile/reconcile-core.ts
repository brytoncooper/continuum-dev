import type {
  ReconcileInput,
  ReconciliationResult,
} from '../types.js';

import {
  buildInitialSnapshotFromView,
  buildResultForPriorDataWithoutView,
} from '../reconciliation/result-builder/index.js';
import { resolveReconciliationTimestamp } from './time.js';
import { reconcileViewTransition } from './transition.js';

export function reconcileImpl(input: ReconcileInput): ReconciliationResult {
  const { newView, priorView, priorData, options } = input;
  const now = resolveReconciliationTimestamp(priorData, options);

  if (!priorData) {
    return buildInitialSnapshotFromView({ newView, now });
  }

  if (!priorView) {
    return buildResultForPriorDataWithoutView({
      newView,
      priorData,
      now,
      options,
    });
  }

  return reconcileViewTransition({
    newView,
    priorView,
    priorData,
    now,
    options,
  });
}
