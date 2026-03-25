import type {
  DataSnapshot,
  DetachedValue,
  NodeValue,
  ViewDefinition,
} from '@continuum-dev/core';
import { applyContinuumViewUpdate } from '@continuum-dev/runtime';
import {
  buildViewEvolutionDiagnostics,
  shouldRejectAiEditDiagnostics,
  type ShouldRejectAiEditDiagnosticsOptions,
} from '@continuum-dev/runtime/view-evolution';
import type { DetachedFieldHint } from '@continuum-dev/prompts';
import type {
  ContinuumTransformPlan,
  ViewEvolutionDiagnostics,
} from '@continuum-dev/protocol';
import type { AppliedContinuumViewState } from '@continuum-dev/runtime';

const EVALUATOR_SESSION_ID = 'continuum-execution-evaluator';

function isNodeValue(value: unknown): value is NodeValue {
  return typeof value === 'object' && value !== null && 'value' in value;
}

function normalizeDetachedReason(
  reason: string
): DetachedValue['reason'] {
  if (reason === 'type-mismatch' || reason === 'migration-failed') {
    return reason;
  }

  return 'node-removed';
}

function buildDetachedValues(
  detachedFields: DetachedFieldHint[]
): Record<string, DetachedValue> {
  const detachedValues: Record<string, DetachedValue> = {};

  for (const field of detachedFields) {
    detachedValues[field.detachedKey] = {
      value: field.valuePreview,
      previousNodeType: field.previousNodeType,
      ...(typeof field.key === 'string' && field.key.trim().length > 0
        ? { key: field.key.trim() }
        : {}),
      ...(typeof field.previousLabel === 'string'
        ? { previousLabel: field.previousLabel }
        : {}),
      ...(typeof field.previousParentLabel === 'string'
        ? { previousParentLabel: field.previousParentLabel }
        : {}),
      detachedAt: 0,
      viewVersion: field.viewVersion,
      reason: normalizeDetachedReason(field.reason),
    };
  }

  return detachedValues;
}

function buildBaseDataSnapshot(args: {
  currentView: ViewDefinition | undefined;
  nextView: ViewDefinition;
  currentData: unknown;
  detachedFields: DetachedFieldHint[];
}): DataSnapshot | null {
  const values = Object.fromEntries(
    Object.entries(
      args.currentData && typeof args.currentData === 'object'
        ? (args.currentData as Record<string, unknown>)
        : {}
    ).filter(([, value]) => isNodeValue(value))
  ) as Record<string, NodeValue>;

  const detachedValues = buildDetachedValues(args.detachedFields);
  if (
    Object.keys(values).length === 0 &&
    Object.keys(detachedValues).length === 0
  ) {
    return null;
  }

  const view = args.currentView ?? args.nextView;
  return {
    values,
    lineage: {
      timestamp: 0,
      sessionId: EVALUATOR_SESSION_ID,
      viewId: view.viewId,
      viewVersion: view.version,
    },
    ...(Object.keys(detachedValues).length > 0 ? { detachedValues } : {}),
  };
}

export interface EvaluateRuntimeViewTransitionInput {
  currentView?: ViewDefinition;
  nextView: ViewDefinition;
  currentData: unknown;
  detachedFields: DetachedFieldHint[];
  registeredIntentIds?: ReadonlySet<string>;
  affectedNodeIds?: string[];
  incrementalHint?: 'presentation-content';
  transformPlan?: ContinuumTransformPlan;
  rejectOptions?: ShouldRejectAiEditDiagnosticsOptions;
}

export interface RuntimeViewTransitionEvaluation {
  appliedState: AppliedContinuumViewState;
  diagnostics?: ViewEvolutionDiagnostics;
  rejectionReason?: string;
}

export function evaluateRuntimeViewTransition(
  input: EvaluateRuntimeViewTransitionInput
): RuntimeViewTransitionEvaluation {
  const baseData = buildBaseDataSnapshot({
    currentView: input.currentView,
    nextView: input.nextView,
    currentData: input.currentData,
    detachedFields: input.detachedFields,
  });

  const appliedState = applyContinuumViewUpdate({
    baseView: input.currentView ?? null,
    baseData,
    nextView: input.nextView,
    sessionId: EVALUATOR_SESSION_ID,
    clock: () => 0,
    affectedNodeIds: input.affectedNodeIds,
    incrementalHint: input.incrementalHint,
    transformPlan: input.transformPlan,
  });

  if (!input.currentView) {
    return { appliedState };
  }

  const diagnostics = buildViewEvolutionDiagnostics({
    priorView: input.currentView,
    nextView: appliedState.view,
    priorData: baseData ?? undefined,
    nextData: appliedState.data,
    registeredIntentIds: input.registeredIntentIds,
  });

  if (shouldRejectAiEditDiagnostics(diagnostics, input.rejectOptions)) {
    return {
      appliedState,
      diagnostics,
      rejectionReason: 'Runtime evaluation rejected the generated view transition.',
    };
  }

  return {
    appliedState,
    diagnostics,
  };
}

export function buildViewEvaluationErrors(
  diagnostics: ViewEvolutionDiagnostics
): string[] {
  return [
    `Runtime metrics: ${JSON.stringify(diagnostics.metrics)}`,
    ...diagnostics.issues.map(
      (issue) => `${issue.code}: ${issue.message}`
    ),
  ];
}
