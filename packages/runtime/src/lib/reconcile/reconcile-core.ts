import type {
  DataSnapshot,
  ViewDefinition,
} from '@continuum-dev/contract';
import type {
  ReconcileInput,
  ReconciliationOptions,
  ReconciliationResult,
} from '../types.js';
import {
  buildBlindCarryResult,
  buildFreshSessionResult,
} from '../reconciliation/result-builder/index.js';
import { resolveReconciliationTimestamp } from './time.js';
import { reconcileViewTransition } from './transition.js';

export function reconcileImpl(input: ReconcileInput): ReconciliationResult;
export function reconcileImpl(
  /**
   * @deprecated Pass a single `ReconcileInput` object instead.
   */
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options: ReconciliationOptions
): ReconciliationResult;
export function reconcileImpl(
  inputOrNewView: ReconcileInput | ViewDefinition,
  priorView?: ViewDefinition | null,
  priorData?: DataSnapshot | null,
  options?: ReconciliationOptions
): ReconciliationResult {
  const input = normalizeReconcileInput(
    inputOrNewView,
    priorView,
    priorData,
    options
  );
  const {
    newView,
    priorView: resolvedPriorView,
    priorData: resolvedPriorData,
    options: resolvedOptions,
  } = input;
  const now = resolveReconciliationTimestamp(resolvedPriorData, resolvedOptions);

  if (!resolvedPriorData) {
    return buildFreshSessionResult(newView, now);
  }

  if (!resolvedPriorView) {
    return buildBlindCarryResult(newView, resolvedPriorData, now, resolvedOptions);
  }

  return reconcileViewTransition(
    newView,
    resolvedPriorView,
    resolvedPriorData,
    now,
    resolvedOptions
  );
}

function normalizeReconcileInput(
  inputOrNewView: ReconcileInput | ViewDefinition,
  priorView?: ViewDefinition | null,
  priorData?: DataSnapshot | null,
  options?: ReconciliationOptions
): ReconcileInput {
  if (isReconcileInput(inputOrNewView)) {
    return inputOrNewView;
  }

  if (!options) {
    throw new Error('reconcile requires options');
  }

  return {
    newView: inputOrNewView,
    priorView: priorView ?? null,
    priorData: priorData ?? null,
    options,
  };
}

function isReconcileInput(value: ReconcileInput | ViewDefinition): value is ReconcileInput {
  return 'newView' in value && 'options' in value;
}
