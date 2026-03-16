import type { AiConnectClient } from '@continuum-dev/ai-connect';
import type {
  DetachedFieldHint,
  PromptAddon,
  PromptMode,
} from '@continuum-dev/prompts';
import type { StarterKitSessionSnapshot } from '../session/index.js';
import type { StarterKitSessionAdapter } from '../session/index.js';
import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
  type StarterKitViewAuthoringFormat,
} from '../view-authoring/index.js';
import { isViewDefinition } from '../view-guardrails/index.js';
import { applyThroughStreamingFoundation } from './apply.js';
import {
  buildRuntimeErrors,
  collectCandidateViewErrors,
  normalizeGeneratedView,
} from './normalize.js';
import {
  getFullGenerateOptions,
  getRepairGenerateOptions,
  shouldAttemptRepair,
} from './provider-policy.js';
import type { StarterKitRunViewGenerationResult } from './types.js';

export async function generateFullView(args: {
  provider: AiConnectClient;
  session: StarterKitSessionAdapter;
  snapshot: StarterKitSessionSnapshot;
  instruction: string;
  mode: PromptMode;
  addons?: PromptAddon[];
  authoringFormat: StarterKitViewAuthoringFormat;
  autoApplyView: boolean;
  detachedFields: DetachedFieldHint[];
  issues: unknown[];
}): Promise<StarterKitRunViewGenerationResult> {
  const result = await args.provider.generate({
    systemPrompt: buildViewAuthoringSystemPrompt({
      format: args.authoringFormat,
      mode: args.mode,
      addons: args.addons,
    }),
    userMessage: buildViewAuthoringUserMessage({
      format: args.authoringFormat,
      mode: args.mode,
      instruction: args.instruction,
      currentView: args.mode === 'create-view' ? undefined : args.snapshot.view,
      detachedFields:
        args.mode === 'create-view' ? undefined : args.detachedFields,
      runtimeErrors:
        args.mode === 'correction-loop'
          ? buildRuntimeErrors(args.issues)
          : undefined,
    }),
    ...getFullGenerateOptions(args.provider),
  });

  let finalResult = result;
  let parsed = parseViewAuthoringToViewDefinition({
    format: args.authoringFormat,
    text: result.text,
    fallbackView: args.snapshot.view,
  });

  if (
    shouldAttemptRepair({
      autoApplyView: args.autoApplyView,
      provider: args.provider,
    })
  ) {
    const candidateErrors = collectCandidateViewErrors(args.snapshot.view, parsed);

    if (candidateErrors.length > 0) {
      finalResult = await args.provider.generate({
        systemPrompt: buildViewAuthoringSystemPrompt({
          format: args.authoringFormat,
          mode: 'correction-loop',
          addons: args.addons,
        }),
        userMessage: buildViewAuthoringUserMessage({
          format: args.authoringFormat,
          mode: 'correction-loop',
          instruction: args.instruction,
          currentView: args.snapshot.view,
          detachedFields: args.detachedFields,
          validationErrors: candidateErrors.slice(0, 8),
          runtimeErrors: buildRuntimeErrors(args.issues),
        }),
        ...getRepairGenerateOptions(args.provider),
      });
      parsed = parseViewAuthoringToViewDefinition({
        format: args.authoringFormat,
        text: finalResult.text,
        fallbackView: args.snapshot.view,
      });
    }
  }

  if (args.autoApplyView && isViewDefinition(parsed)) {
    const normalizedView = normalizeGeneratedView(args.snapshot.view, parsed);
    if (
      !applyThroughStreamingFoundation(
        args.session,
        args.provider.label,
        normalizedView.viewId,
        [{ kind: 'view', view: normalizedView }],
        'draft'
      )
    ) {
      args.session.applyView(normalizedView);
    }

    return {
      result: finalResult,
      parsed,
      status: `Applied a draft-committed Continuum view ${normalizedView.viewId}@${normalizedView.version} from ${args.provider.label}.`,
    };
  }

  return {
    result: finalResult,
    parsed,
    status: `Received response from ${args.provider.label}.`,
  };
}
