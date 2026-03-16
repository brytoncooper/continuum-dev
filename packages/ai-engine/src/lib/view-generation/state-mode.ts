import type { AiConnectClient } from '@continuum-dev/ai-connect';
import type { StarterKitSessionSnapshot } from '../session/index.js';
import type { StarterKitSessionAdapter } from '../session/index.js';
import {
  parseStarterKitStateResponse,
  type StarterKitExecutionTarget,
} from '../execution-targets/index.js';
import { applyStateUpdatesThroughStreamingFoundation } from './apply.js';
import { getPatchGenerateOptions } from './provider-policy.js';
import type { StarterKitRunViewGenerationResult } from './types.js';

export function buildStateSystemPrompt(): string {
  return [
    'You author Continuum data updates for a client-side session runtime.',
    'Return exactly one JSON object and nothing else.',
    'Do not wrap the JSON in markdown fences.',
    'Return a state response, not a view or patch response.',
    'State response shape: {"updates":[...],"status":"optional short summary"}.',
    'Each update must target one of the provided selected targets by semanticKey, key, or nodeId.',
    'Only update existing stateful nodes that should actually change.',
    'Do not invent new node ids, semantic keys, or keys.',
    'Do not mutate view structure.',
    'For collections, target the collection node and provide {"value":{"items":[...]}}.',
    'Collection item objects should use template field semanticKey, key, or nodeId from the provided catalog.',
    'Prefer preserving meaningful user-entered values unless the instruction explicitly asks to overwrite them.',
  ].join('\n');
}

export function buildStateUserMessage(args: {
  instruction: string;
  currentData: unknown;
  stateTargets: unknown[];
  selectedTargets: string[];
}): string {
  return [
    'Return the next Continuum state updates as JSON only.',
    '',
    'Selected targets:',
    JSON.stringify(args.selectedTargets, null, 2),
    '',
    'Available state targets:',
    JSON.stringify(args.stateTargets, null, 2),
    '',
    'Current state values:',
    JSON.stringify(args.currentData ?? null, null, 2),
    '',
    'Instruction:',
    args.instruction.trim(),
  ].join('\n');
}

export async function tryRunStateMode(args: {
  autoApplyView: boolean;
  provider: AiConnectClient;
  session: StarterKitSessionAdapter;
  instruction: string;
  snapshot: StarterKitSessionSnapshot;
  stateTargets: StarterKitExecutionTarget[];
  selectedTargets: string[];
}): Promise<StarterKitRunViewGenerationResult | null> {
  if (!args.autoApplyView) {
    return null;
  }

  const stateResult = await args.provider.generate({
    systemPrompt: buildStateSystemPrompt(),
    userMessage: buildStateUserMessage({
      instruction: args.instruction,
      currentData: args.snapshot.data.values,
      stateTargets: args.stateTargets,
      selectedTargets: args.selectedTargets,
    }),
    ...getPatchGenerateOptions(args.provider),
  });

  const parsedState =
    parseStarterKitStateResponse({
      text: stateResult.text,
      targetCatalog: args.stateTargets,
    }) ?? null;

  if (
    !parsedState ||
    parsedState.updates.length === 0 ||
    !applyStateUpdatesThroughStreamingFoundation(
      args.session,
      args.provider.label,
      args.snapshot.view,
      parsedState.updates
    )
  ) {
    return null;
  }

  return {
    result: stateResult,
    parsed: parsedState,
    status:
      parsedState.status ??
      `Planner chose state mode and applied ${parsedState.updates.length} Continuum state update${
        parsedState.updates.length === 1 ? '' : 's'
      } from ${args.provider.label}.`,
  };
}
