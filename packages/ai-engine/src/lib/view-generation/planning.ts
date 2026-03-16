import type { AiConnectClient } from '@continuum-dev/ai-connect';
import type {
  ContinuumExecutionMode,
  ContinuumExecutionTarget,
  ContinuumResolvedExecutionPlan,
} from '../continuum-execution/index.mjs';
import {
  buildContinuumExecutionPlannerSystemPrompt,
  buildContinuumExecutionPlannerUserPrompt,
  resolveContinuumExecutionPlan,
} from '../continuum-execution/index.mjs';
import { getPatchGenerateOptions } from './provider-policy.js';

export async function planExecutionMode(args: {
  autoApplyView: boolean;
  provider: AiConnectClient;
  availableExecutionModes: ContinuumExecutionMode[];
  patchTargets: ContinuumExecutionTarget[];
  stateTargets: ContinuumExecutionTarget[];
  compactTree: unknown[];
  currentData: Record<string, unknown>;
  instruction: string;
}): Promise<ContinuumResolvedExecutionPlan> {
  if (!args.autoApplyView || args.availableExecutionModes.length === 1) {
    return {
      mode: args.availableExecutionModes[0] ?? 'view',
      fallback: 'view',
      reason: args.autoApplyView
        ? 'only available mode'
        : 'view generation requested',
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: 'accepted',
    };
  }

  const planResult = await args.provider.generate({
    systemPrompt: buildContinuumExecutionPlannerSystemPrompt(),
    userMessage: buildContinuumExecutionPlannerUserPrompt({
      availableModes: args.availableExecutionModes,
      patchTargets: args.patchTargets,
      stateTargets: args.stateTargets,
      compactTree: args.compactTree,
      currentData: args.currentData,
      instruction: args.instruction,
    }),
    ...getPatchGenerateOptions(args.provider),
  });

  return resolveContinuumExecutionPlan({
    text: planResult.text,
    availableModes: args.availableExecutionModes,
    patchTargets: args.patchTargets,
    stateTargets: args.stateTargets,
  });
}
