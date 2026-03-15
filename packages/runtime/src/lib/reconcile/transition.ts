import type { DataSnapshot, ViewDefinition } from '@continuum-dev/contract';
import {
  buildPriorValueLookupByIdAndKey,
  buildReconciliationContext,
} from '../context/index.js';
import type {
  ReconciliationOptions,
  ReconciliationResult,
  NodeResolutionAccumulator,
} from '../types.js';
import { resolveAllNodes, detectRemovedNodes } from '../reconciliation/node-resolver/index.js';
import {
  assembleReconciliationResult,
  type RemovedNodesResult,
} from '../reconciliation/result-builder/index.js';
import { applySemanticKeyMoves } from './semantic-moves/semantic-key-moves.js';
import { restoreFromSamePushDetachments } from './same-push-restore.js';

interface TransitionStagesState {
  context: ReturnType<typeof buildReconciliationContext>;
  resolved: NodeResolutionAccumulator;
  removals: RemovedNodesResult;
}

export function reconcileViewTransition(
  newView: ViewDefinition,
  priorView: ViewDefinition,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): ReconciliationResult {
  const context = buildReconciliationContext(newView, priorView);
  const stageState = runResolutionStages(context, priorData, now, options);
  runPostResolutionStages(stageState, priorData);
  const result = assembleReconciliationResult({
    resolved: stageState.resolved,
    removals: stageState.removals,
    priorData,
    newView,
    now,
  });
  result.issues.unshift(...context.issues);
  return result;
}

function runResolutionStages(
  context: ReturnType<typeof buildReconciliationContext>,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): TransitionStagesState {
  const priorValues = buildPriorValueLookupByIdAndKey(priorData, context);
  const resolved = resolveAllNodes(context, priorValues, priorData, now, options);
  const removals = detectRemovedNodes(context, priorData, options, now);
  return {
    context,
    resolved,
    removals,
  };
}

function runPostResolutionStages(
  stageState: TransitionStagesState,
  priorData: DataSnapshot
): void {
  restoreFromSamePushDetachments(
    stageState.resolved,
    stageState.removals,
    stageState.context
  );
  applySemanticKeyMoves(stageState.context, priorData, stageState.resolved);
}
