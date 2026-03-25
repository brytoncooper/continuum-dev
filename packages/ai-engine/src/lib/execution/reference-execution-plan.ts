import type { ViewDefinition } from '@continuum-dev/core';
import type { PromptMode } from '@continuum-dev/prompts';
import type { ContinuumExecutionTarget } from '../execution-targets/index.js';
import {
  inferPromptMode,
  looksLikeStructuralEditInstruction,
} from './stream/instruction/instruction-heuristics.js';
import type { ContinuumExecutionMode } from './planner-types.js';
import type { SelectedExecutionPlan } from './stream/stream-execution-types.js';

function looksLikePopulateInstruction(instruction: string): boolean {
  return /\b(fill|prefill|populate|repopulate|sample|demo)\b/i.test(
    instruction.trim()
  );
}

function looksLikeTransformInstruction(instruction: string): boolean {
  const t = instruction.trim().toLowerCase();
  return /\b(merge|split|combine|into\s+full|into\s+one|remap|transform)\b/.test(
    t
  );
}

function looksLikeGreenfieldViewInstruction(instruction: string): boolean {
  return /\b(instead|rather than|new workflow|different form|switch to)\b/i.test(
    instruction.trim()
  );
}

export function buildReferenceExecutionPlan(args: {
  autoApplyView: boolean;
  instruction: string;
  currentView: ViewDefinition | undefined;
  patchTargets: ContinuumExecutionTarget[];
  stateTargets: ContinuumExecutionTarget[];
  requestedMode: PromptMode | undefined;
  availableExecutionModes: ContinuumExecutionMode[];
}): SelectedExecutionPlan {
  const base = {
    fallback: 'view' as const,
    targetNodeIds: [] as string[],
    targetSemanticKeys: [] as string[],
    validation: 'accepted' as const,
    integrationValidation: 'not-applicable' as const,
  };

  if (!args.autoApplyView) {
    const promptMode = inferPromptMode(args.requestedMode, args.currentView);
    return {
      ...base,
      mode: 'view',
      reason: 'Reference executor: autoApplyView is disabled.',
      authoringMode:
        promptMode === 'create-view' || promptMode === 'evolve-view'
          ? promptMode
          : undefined,
    };
  }

  const currentView = args.currentView;
  const instruction = args.instruction;
  const promptMode = inferPromptMode(args.requestedMode, currentView);

  if (!currentView || !currentView.nodes?.length) {
    return {
      ...base,
      mode: 'view',
      reason: 'Reference executor: no current view.',
      authoringMode: 'create-view',
    };
  }

  const modes = new Set(args.availableExecutionModes);

  if (
    modes.has('transform') &&
    looksLikeTransformInstruction(instruction)
  ) {
    return {
      ...base,
      mode: 'transform',
      reason: 'Reference executor: instruction looks like schema evolution.',
    };
  }

  if (
    modes.has('state') &&
    looksLikePopulateInstruction(instruction) &&
    args.stateTargets.length > 0
  ) {
    const first = args.stateTargets[0];
    return {
      ...base,
      mode: 'state',
      reason: 'Reference executor: populate-style instruction.',
      targetNodeIds: first?.nodeId ? [first.nodeId] : [],
      targetSemanticKeys: first?.semanticKey ? [first.semanticKey] : [],
    };
  }

  if (
    modes.has('patch') &&
    looksLikeStructuralEditInstruction(instruction) &&
    args.patchTargets.length > 0
  ) {
    const first = args.patchTargets[0];
    return {
      ...base,
      mode: 'patch',
      reason: 'Reference executor: structural edit with patch targets.',
      targetNodeIds: first?.nodeId ? [first.nodeId] : [],
      targetSemanticKeys: first?.semanticKey ? [first.semanticKey] : [],
      authoringMode:
        promptMode === 'create-view' || promptMode === 'evolve-view'
          ? promptMode
          : undefined,
    };
  }

  if (looksLikeGreenfieldViewInstruction(instruction)) {
    return {
      ...base,
      mode: 'view',
      reason: 'Reference executor: new workflow phrasing.',
      authoringMode: 'create-view',
    };
  }

  return {
    ...base,
    mode: 'view',
    reason: 'Reference executor: default full view path.',
    authoringMode:
      promptMode === 'create-view' || promptMode === 'evolve-view'
        ? promptMode
        : undefined,
  };
}
