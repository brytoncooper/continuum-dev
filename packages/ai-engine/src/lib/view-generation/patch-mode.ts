import type { AiConnectClient } from '@continuum-dev/ai-connect';
import type { DetachedFieldHint, PromptMode } from '@continuum-dev/prompts';
import { parseJson } from '../view-guardrails/index.js';
import type { StarterKitSessionSnapshot } from '../session/index.js';
import type { StarterKitSessionAdapter } from '../session/index.js';
import {
  buildPatchContext,
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  isViewPatchPlan,
  type PatchContextPayload,
} from '../view-patching/index.js';
import { applyPatchPlanThroughUpdateParts } from './apply.js';
import { getPatchGenerateOptions } from './provider-policy.js';
import type { StarterKitRunViewGenerationResult } from './types.js';

export async function tryRunPatchMode(args: {
  autoApplyView: boolean;
  provider: AiConnectClient;
  session: StarterKitSessionAdapter;
  instruction: string;
  snapshot: StarterKitSessionSnapshot;
  patchContext: PatchContextPayload;
  detachedFields: DetachedFieldHint[];
  selectedTargets: string[];
}): Promise<{
  applied: StarterKitRunViewGenerationResult | null;
  nextFullRunMode?: PromptMode;
}> {
  if (!args.autoApplyView) {
    return { applied: null };
  }

  try {
    const patchResult = await args.provider.generate({
      systemPrompt: buildPatchSystemPrompt(),
      userMessage: [
        buildPatchUserMessage({
          viewId: args.snapshot.view.viewId,
          version: args.snapshot.view.version,
          instruction: args.instruction,
          nodeHints: args.patchContext.nodeHints,
          compactTree: args.patchContext.compactTree,
          detachedFields: args.detachedFields,
        }),
        'Planner-selected localized targets:',
        JSON.stringify(args.selectedTargets, null, 2),
      ].join('\n\n'),
      ...getPatchGenerateOptions(args.provider),
    });
    const patchParsed = patchResult.json ?? parseJson(patchResult.text);

    if (
      isViewPatchPlan(patchParsed) &&
      applyPatchPlanThroughUpdateParts(
        args.session,
        args.provider.label,
        args.snapshot.view,
        patchParsed
      )
    ) {
      return {
        applied: {
          result: patchResult,
          parsed: patchParsed,
          status: `Planner chose patch mode and applied localized Continuum update operations to ${args.snapshot.view.viewId}@${args.snapshot.view.version} from ${args.provider.label}.`,
        },
      };
    }

    if (
      isViewPatchPlan(patchParsed) &&
      patchParsed.mode === 'full' &&
      patchParsed.fullStrategy === 'replace'
    ) {
      return {
        applied: null,
        nextFullRunMode: 'create-view',
      };
    }
  } catch (error) {
    void error;
  }

  return { applied: null };
}

export { buildPatchContext };
