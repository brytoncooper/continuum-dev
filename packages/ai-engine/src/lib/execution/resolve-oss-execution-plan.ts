import type { ViewDefinition } from '@continuum-dev/core';
import type { PromptMode } from '@continuum-dev/prompts';
import { indexTargets } from '../continuum-execution/index.mjs';
import type { ContinuumExecutionTarget } from '../execution-targets/index.js';
import type { ContinuumExecutionMode, ContinuumExecutionPlan } from './planner-types.js';
import { inferPromptMode } from './stream/instruction/instruction-heuristics.js';
import type { SelectedExecutionPlan } from './stream/stream-execution-types.js';

function buildDefaultViewPlan(args: {
  authoringPromptMode: PromptMode | undefined;
  currentView: ViewDefinition | undefined;
}): SelectedExecutionPlan {
  const inferred = inferPromptMode(args.authoringPromptMode, args.currentView);
  const authoringMode =
    inferred === 'create-view' || inferred === 'evolve-view' ? inferred : undefined;
  return {
    mode: 'view',
    fallback: 'view',
    reason: 'OSS default: full view generation.',
    targetNodeIds: [],
    targetSemanticKeys: [],
    validation: 'accepted',
    integrationValidation: 'not-applicable',
    authoringMode:
      !args.currentView || !args.currentView.nodes?.length
        ? 'create-view'
        : authoringMode ?? 'evolve-view',
  };
}

function filterTargetsForMode(
  mode: ContinuumExecutionMode,
  targetNodeIds: string[],
  targetSemanticKeys: string[],
  stateTargets: ContinuumExecutionTarget[],
  patchTargets: ContinuumExecutionTarget[]
): { targetNodeIds: string[]; targetSemanticKeys: string[]; validation: string } {
  const catalog =
    mode === 'state'
      ? indexTargets(stateTargets)
      : indexTargets(patchTargets);
  const matchedNodeIds: string[] = [];
  const matchedSemanticKeys: string[] = [];
  for (const id of targetNodeIds) {
    if (catalog.byNodeId.has(id)) {
      matchedNodeIds.push(id);
    }
  }
  for (const key of targetSemanticKeys) {
    if (catalog.bySemanticKey.has(key)) {
      matchedSemanticKeys.push(key);
    }
  }
  const hadUnknownTargets =
    matchedNodeIds.length < targetNodeIds.length ||
    matchedSemanticKeys.length < targetSemanticKeys.length;
  if (
    mode !== 'transform' &&
    matchedNodeIds.length === 0 &&
    matchedSemanticKeys.length === 0
  ) {
    return {
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: hadUnknownTargets ? 'unknown-targets' : 'missing-targets',
    };
  }
  return {
    targetNodeIds: matchedNodeIds,
    targetSemanticKeys: matchedSemanticKeys,
    validation: hadUnknownTargets ? 'partial-targets' : 'accepted',
  };
}

function planFromExplicitContinuumPlan(args: {
  plan: ContinuumExecutionPlan;
  availableExecutionModes: ContinuumExecutionMode[];
  stateTargets: ContinuumExecutionTarget[];
  patchTargets: ContinuumExecutionTarget[];
  authoringPromptMode: PromptMode | undefined;
  currentView: ViewDefinition | undefined;
}): SelectedExecutionPlan {
  const modes = new Set(args.availableExecutionModes);
  const mode = args.plan.mode;
  if (!modes.has(mode)) {
    return {
      ...buildDefaultViewPlan({
        authoringPromptMode: args.authoringPromptMode,
        currentView: args.currentView,
      }),
      reason: `Execution mode "${mode}" is not available for this context.`,
      validation: 'invalid-plan',
    };
  }

  const base: SelectedExecutionPlan = {
    mode,
    fallback: args.plan.fallback,
    reason: args.plan.reason ?? 'Explicit execution plan.',
    targetNodeIds: [...args.plan.targetNodeIds],
    targetSemanticKeys: [...args.plan.targetSemanticKeys],
    authoringMode: args.plan.authoringMode,
    endpointId: args.plan.endpointId,
    payloadSemanticKeys: args.plan.payloadSemanticKeys,
    validation: 'accepted',
    integrationValidation: 'not-applicable',
  };

  if (mode === 'view') {
    const defaulted = buildDefaultViewPlan({
      authoringPromptMode: args.authoringPromptMode,
      currentView: args.currentView,
    });
    return {
      ...base,
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: 'accepted',
      authoringMode: args.plan.authoringMode ?? defaulted.authoringMode,
    };
  }

  if (mode === 'transform') {
    return {
      ...base,
      validation: 'accepted',
    };
  }

  const filtered = filterTargetsForMode(
    mode,
    base.targetNodeIds,
    base.targetSemanticKeys,
    args.stateTargets,
    args.patchTargets
  );

  return {
    ...base,
    targetNodeIds: filtered.targetNodeIds,
    targetSemanticKeys: filtered.targetSemanticKeys,
    validation: filtered.validation as SelectedExecutionPlan['validation'],
  };
}

function planFromExecutionMode(args: {
  mode: ContinuumExecutionMode;
  availableExecutionModes: ContinuumExecutionMode[];
  stateTargets: ContinuumExecutionTarget[];
  patchTargets: ContinuumExecutionTarget[];
  authoringPromptMode: PromptMode | undefined;
  currentView: ViewDefinition | undefined;
}): SelectedExecutionPlan {
  const modes = new Set(args.availableExecutionModes);
  if (!modes.has(args.mode)) {
    return {
      ...buildDefaultViewPlan({
        authoringPromptMode: args.authoringPromptMode,
        currentView: args.currentView,
      }),
      reason: `Execution mode "${args.mode}" is not available for this context.`,
      validation: 'invalid-plan',
    };
  }

  if (args.mode === 'view') {
    return buildDefaultViewPlan({
      authoringPromptMode: args.authoringPromptMode,
      currentView: args.currentView,
    });
  }

  if (args.mode === 'transform') {
    return {
      mode: 'transform',
      fallback: 'view',
      reason: 'Explicit execution mode: transform.',
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: 'accepted',
      integrationValidation: 'not-applicable',
    };
  }

  if (args.mode === 'state') {
    const first = args.stateTargets[0];
    return {
      mode: 'state',
      fallback: 'view',
      reason: 'Explicit execution mode: state.',
      targetNodeIds: first?.nodeId ? [first.nodeId] : [],
      targetSemanticKeys: first?.semanticKey ? [first.semanticKey] : [],
      validation: 'accepted',
      integrationValidation: 'not-applicable',
    };
  }

  const firstPatch = args.patchTargets[0];
  const promptMode = inferPromptMode(args.authoringPromptMode, args.currentView);
  return {
    mode: 'patch',
    fallback: 'view',
    reason: 'Explicit execution mode: patch.',
    targetNodeIds: firstPatch?.nodeId ? [firstPatch.nodeId] : [],
    targetSemanticKeys: firstPatch?.semanticKey ? [firstPatch.semanticKey] : [],
    validation: 'accepted',
    integrationValidation: 'not-applicable',
    authoringMode:
      promptMode === 'create-view' || promptMode === 'evolve-view'
        ? promptMode
        : undefined,
  };
}

export function resolveOssExecutionPlan(args: {
  executionPlan?: ContinuumExecutionPlan;
  executionMode?: ContinuumExecutionMode;
  authoringPromptMode: PromptMode | undefined;
  availableExecutionModes: ContinuumExecutionMode[];
  stateTargets: ContinuumExecutionTarget[];
  patchTargets: ContinuumExecutionTarget[];
  currentView: ViewDefinition | undefined;
}): SelectedExecutionPlan {
  if (args.executionPlan) {
    return planFromExplicitContinuumPlan({
      plan: args.executionPlan,
      availableExecutionModes: args.availableExecutionModes,
      stateTargets: args.stateTargets,
      patchTargets: args.patchTargets,
      authoringPromptMode: args.authoringPromptMode,
      currentView: args.currentView,
    });
  }

  if (args.executionMode) {
    return planFromExecutionMode({
      mode: args.executionMode,
      availableExecutionModes: args.availableExecutionModes,
      stateTargets: args.stateTargets,
      patchTargets: args.patchTargets,
      authoringPromptMode: args.authoringPromptMode,
      currentView: args.currentView,
    });
  }

  return buildDefaultViewPlan({
    authoringPromptMode: args.authoringPromptMode,
    currentView: args.currentView,
  });
}
