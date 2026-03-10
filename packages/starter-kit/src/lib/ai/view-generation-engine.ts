import type {
  AiConnectClient,
  AiConnectGenerateResult,
} from '@continuum-dev/ai-connect';
import {
  type PromptAddon,
  type PromptMode,
  type PromptOutputContract,
} from '@continuum-dev/prompts';
import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
  type StarterKitViewAuthoringFormat,
} from './view-authoring.js';
import { buildDetachedFieldHints, buildPatchContext } from './patch-context.js';
import {
  getFullGenerateOptions,
  getPatchGenerateOptions,
  getRepairGenerateOptions,
  shouldAttemptRepair,
  shouldUsePatchMode,
} from './provider-policy.js';
import type { StarterKitSessionAdapter } from './session-adapter.js';
import {
  applyPatchPlanToView,
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  isViewPatchPlan,
} from './view-patch-plan.js';
import {
  buildRuntimeErrors,
  collectStructuralErrors,
  collectUnsupportedNodeTypes,
  isViewDefinition,
  normalizeViewDefinition,
  parseJson,
  SUPPORTED_NODE_TYPE_VALUES,
} from './view-guardrails.js';

export interface StarterKitRunViewGenerationArgs {
  provider: AiConnectClient;
  session: StarterKitSessionAdapter;
  instruction: string;
  mode: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: StarterKitViewAuthoringFormat;
  autoApplyView?: boolean;
}

export interface StarterKitRunViewGenerationResult {
  result: AiConnectGenerateResult;
  parsed: unknown;
  status: string;
}

function shouldUseViewDsl(provider: AiConnectClient): boolean {
  void provider;
  return true;
}

export async function runStarterKitViewGeneration(
  args: StarterKitRunViewGenerationArgs
): Promise<StarterKitRunViewGenerationResult> {
  const autoApplyView = args.autoApplyView ?? true;
  void args.outputContract;
  const snapshot = args.session.getSnapshot();

  if (!snapshot) {
    throw new Error('No active Continuum snapshot is available yet.');
  }

  const detachedValues = args.session.getDetachedValues();
  const detachedFields = buildDetachedFieldHints(detachedValues);
  const issues = args.session.getIssues();
  let fullRunMode: PromptMode = args.mode;
  const useViewDsl = shouldUseViewDsl(args.provider);
  const authoringFormat = args.authoringFormat ?? 'line-dsl';

  if (
    shouldUsePatchMode({
      autoApplyView,
      mode: args.mode,
      provider: args.provider,
    })
  ) {
    try {
      const patchContext = buildPatchContext(snapshot.view);
      const patchResult = await args.provider.generate({
        systemPrompt: buildPatchSystemPrompt(),
        userMessage: buildPatchUserMessage({
          viewId: snapshot.view.viewId,
          version: snapshot.view.version,
          instruction: args.instruction,
          nodeHints: patchContext.nodeHints,
          compactTree: patchContext.compactTree,
          detachedFields,
        }),
        ...getPatchGenerateOptions(args.provider),
      });
      const patchParsed = patchResult.json ?? parseJson(patchResult.text);

      if (isViewPatchPlan(patchParsed)) {
        const patchedView = applyPatchPlanToView(snapshot.view, patchParsed);
        if (patchedView) {
          const normalizedPatchedView = normalizeViewDefinition(patchedView);
          const patchUnsupported = collectUnsupportedNodeTypes(
            normalizedPatchedView.nodes
          );
          const patchStructuralErrors = collectStructuralErrors(
            normalizedPatchedView.nodes
          );

          if (
            patchUnsupported.length === 0 &&
            patchStructuralErrors.length === 0
          ) {
            args.session.applyView(normalizedPatchedView);
            return {
              result: patchResult,
              parsed: patchParsed,
              status: `Applied patch ${snapshot.view.viewId}@${snapshot.view.version} -> @${normalizedPatchedView.version} from ${args.provider.label}.`,
            };
          }
        }

        if (
          patchParsed.mode === 'full' &&
          patchParsed.fullStrategy === 'replace'
        ) {
          fullRunMode = 'create-view';
        }
      }
    } catch (error) {
      void error;
    }
  }

  const systemPrompt = useViewDsl
    ? buildViewAuthoringSystemPrompt({
        format: authoringFormat,
        mode: fullRunMode,
        addons: args.addons,
      })
    : '';

  const userMessage = useViewDsl
    ? buildViewAuthoringUserMessage({
        format: authoringFormat,
        mode: fullRunMode,
        instruction: args.instruction,
        currentView:
          fullRunMode === 'create-view' ? undefined : snapshot.view,
        detachedFields:
          fullRunMode === 'create-view' ? undefined : detachedFields,
        validationErrors:
          fullRunMode === 'correction-loop'
            ? issues.map((issue) => JSON.stringify(issue))
            : undefined,
        runtimeErrors:
          fullRunMode === 'correction-loop'
            ? buildRuntimeErrors(issues)
            : undefined,
      })
    : '';

  const result = await args.provider.generate({
    systemPrompt,
    userMessage,
    ...getFullGenerateOptions(args.provider),
  });

  let finalResult = result;
  let parsed = useViewDsl
    ? parseViewAuthoringToViewDefinition({
        format: authoringFormat,
        text: result.text,
        fallbackView: snapshot.view,
      })
    : result.json ?? parseJson(result.text);

  if (
    shouldAttemptRepair({
      autoApplyView,
      provider: args.provider,
    })
  ) {
    const candidateErrors: string[] = [];
    if (!isViewDefinition(parsed)) {
      candidateErrors.push(
        'Model output did not compile into a valid ViewDefinition.'
      );
    } else {
      const unsupported = collectUnsupportedNodeTypes(parsed.nodes);
      if (unsupported.length > 0) {
        candidateErrors.push(
          `Unsupported node types: ${unsupported.join(', ')}.`
        );
      }
      candidateErrors.push(...collectStructuralErrors(parsed.nodes));
    }

    if (candidateErrors.length > 0) {
      const repairPrompt = useViewDsl
        ? buildViewAuthoringSystemPrompt({
            format: authoringFormat,
            mode: 'correction-loop',
            addons: args.addons,
          })
        : '';
      const repairUserMessage = useViewDsl
        ? buildViewAuthoringUserMessage({
            format: authoringFormat,
            mode: 'correction-loop',
            instruction: args.instruction,
            currentView: snapshot.view,
            detachedFields,
            validationErrors: candidateErrors.slice(0, 8),
            runtimeErrors: buildRuntimeErrors(issues),
          })
        : '';
      finalResult = await args.provider.generate({
        systemPrompt: repairPrompt,
        userMessage: repairUserMessage,
        ...getRepairGenerateOptions(args.provider),
      });
      parsed = useViewDsl
        ? parseViewAuthoringToViewDefinition({
            format: authoringFormat,
            text: finalResult.text,
            fallbackView: snapshot.view,
          })
        : finalResult.json ?? parseJson(finalResult.text);
    }
  }

  if (autoApplyView && isViewDefinition(parsed)) {
    const normalizedView = normalizeViewDefinition(parsed);
    const unsupported = collectUnsupportedNodeTypes(normalizedView.nodes);
    if (unsupported.length > 0) {
      throw new Error(
        `Unsupported node types returned: ${unsupported.join(', ')}. Supported types: ${SUPPORTED_NODE_TYPE_VALUES.join(', ')}.`
      );
    }
    const structuralErrors = collectStructuralErrors(normalizedView.nodes);
    if (structuralErrors.length > 0) {
      throw new Error(`Malformed view from model: ${structuralErrors[0]}`);
    }
    args.session.applyView(normalizedView);
    return {
      result: finalResult,
      parsed,
      status: `Applied view ${normalizedView.viewId}@${normalizedView.version} from ${args.provider.label}.`,
    };
  }

  return {
    result: finalResult,
    parsed,
    status: `Received response from ${args.provider.label}.`,
  };
}
