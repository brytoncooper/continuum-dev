import type {
  AiConnectClient,
  AiConnectGenerateResult,
} from '@continuum-dev/ai-connect';
import type { SessionStreamPart } from '@continuum-dev/core';
import type { ViewDefinition } from '@continuum-dev/core';
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
} from './provider-policy.js';
import type { StarterKitSessionAdapter } from './session-adapter.js';
import {
  buildContinuumExecutionPlannerSystemPrompt,
  buildContinuumExecutionPlannerUserPrompt,
  getAvailableContinuumExecutionModes,
  normalizeContinuumSemanticIdentity,
  resolveContinuumExecutionPlan,
} from './continuum-execution.mjs';
import {
  buildStarterKitPatchTargetCatalog,
  buildStarterKitStateTargetCatalog,
  parseStarterKitStateResponse,
} from './execution-targets.js';
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

function buildStateSystemPrompt(): string {
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

function buildStateUserMessage(args: {
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

function normalizeGeneratedView(
  currentView: ViewDefinition,
  nextView: ViewDefinition
): ViewDefinition {
  const normalizedIdentity = normalizeContinuumSemanticIdentity({
    currentView,
    nextView,
  });
  if (normalizedIdentity.errors.length > 0 || !normalizedIdentity.view) {
    throw new Error(
      normalizedIdentity.errors[0] ??
        'Generated view failed semantic identity validation.'
    );
  }

  const normalizedView = normalizeViewDefinition(normalizedIdentity.view);
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

  return normalizedView;
}

function applyThroughStreamingFoundation(
  session: StarterKitSessionAdapter,
  source: string,
  targetViewId: string,
  parts: SessionStreamPart[],
  mode: 'foreground' | 'draft' = 'foreground'
): boolean {
  if (
    typeof session.beginStream !== 'function' ||
    typeof session.applyStreamPart !== 'function' ||
    typeof session.commitStream !== 'function'
  ) {
    return false;
  }

  const baseSnapshot = session.getCommittedSnapshot?.() ?? session.getSnapshot();
  const stream = session.beginStream({
    targetViewId,
    source,
    mode,
    supersede: true,
    baseViewVersion: baseSnapshot?.view.version ?? null,
  });
  for (const part of parts) {
    session.applyStreamPart(stream.streamId, part);
  }
  const result = session.commitStream(stream.streamId);
  if (result.status !== 'committed') {
    throw new Error(
      `Continuum stream commit failed with status "${result.status}"${result.reason ? `: ${result.reason}` : ''}.`
    );
  }
  return true;
}

function applyStateUpdatesThroughStreamingFoundation(
  session: StarterKitSessionAdapter,
  source: string,
  currentView: ViewDefinition,
  updates: Array<{ nodeId: string; value: unknown }>
): boolean {
  return applyThroughStreamingFoundation(
    session,
    source,
    currentView.viewId,
    updates.map((update) => ({
      kind: 'state',
      nodeId: update.nodeId,
      value: update.value,
      source,
    })) as SessionStreamPart[]
  );
}

function applyPatchPlanThroughUpdateParts(
  session: StarterKitSessionAdapter,
  source: string,
  currentView: ViewDefinition,
  plan: unknown
): boolean {
  if (!isViewPatchPlan(plan) || plan.mode !== 'patch' || plan.operations.length === 0) {
    return false;
  }

  const parts = plan.operations.map((operation) => ({ ...operation })) as SessionStreamPart[];
  if (
    applyThroughStreamingFoundation(
      session,
      source,
      currentView.viewId,
      parts
    )
  ) {
    return true;
  }

  const nextView = applyPatchPlanToView(currentView, plan);
  if (!nextView) {
    return false;
  }

  session.applyView(normalizeGeneratedView(currentView, nextView));
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
  const patchContext = buildPatchContext(snapshot.view);
  const stateTargets = buildStarterKitStateTargetCatalog(snapshot.view);
  const patchTargets = buildStarterKitPatchTargetCatalog(snapshot.view);
  const availableExecutionModes = getAvailableContinuumExecutionModes({
    hasCurrentView: snapshot.view.nodes.length > 0,
    hasStateTargets: stateTargets.length > 0,
  });

  const planExecutionMode = async () => {
    if (!autoApplyView || availableExecutionModes.length === 1) {
      return {
        mode: availableExecutionModes[0] ?? 'view',
        fallback: 'view' as const,
        reason: autoApplyView ? 'only available mode' : 'view generation requested',
        targetNodeIds: [] as string[],
        targetSemanticKeys: [] as string[],
        validation: 'accepted' as const,
      };
    }

    const planResult = await args.provider.generate({
      systemPrompt: buildContinuumExecutionPlannerSystemPrompt(),
      userMessage: buildContinuumExecutionPlannerUserPrompt({
        availableModes: availableExecutionModes,
        patchTargets,
        stateTargets,
        compactTree: patchContext.compactTree,
        currentData: snapshot.data.values,
        instruction: args.instruction,
      }),
      ...getPatchGenerateOptions(args.provider),
    });

    return {
      parsed: planResult.json ?? parseJson(planResult.text),
      raw: planResult,
      resolved: resolveContinuumExecutionPlan({
        text: planResult.text,
        availableModes: availableExecutionModes,
        patchTargets,
        stateTargets,
      }),
    };
  };

  const planResult = await planExecutionMode();
  const executionPlan =
    ('resolved' in planResult ? planResult.resolved : planResult) ?? {
      mode: 'view' as const,
      fallback: 'view' as const,
      reason: 'planner fallback',
      targetNodeIds: [] as string[],
      targetSemanticKeys: [] as string[],
      validation: 'invalid-plan' as const,
    };
  const selectedTargets = [
    ...executionPlan.targetNodeIds,
    ...executionPlan.targetSemanticKeys,
  ];

  if (executionPlan.mode === 'state' && autoApplyView) {
    const stateResult = await args.provider.generate({
      systemPrompt: buildStateSystemPrompt(),
      userMessage: buildStateUserMessage({
        instruction: args.instruction,
        currentData: snapshot.data.values,
        stateTargets,
        selectedTargets,
      }),
      ...getPatchGenerateOptions(args.provider),
    });
    const parsedState =
      parseStarterKitStateResponse({
        text: stateResult.text,
        targetCatalog: stateTargets,
      }) ??
      null;

    if (
      parsedState &&
      parsedState.updates.length > 0 &&
      applyStateUpdatesThroughStreamingFoundation(
        args.session,
        args.provider.label,
        snapshot.view,
        parsedState.updates
      )
    ) {
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
  }

  if (executionPlan.mode === 'patch' && autoApplyView) {
    try {
      const patchResult = await args.provider.generate({
        systemPrompt: buildPatchSystemPrompt(),
        userMessage: [
          buildPatchUserMessage({
            viewId: snapshot.view.viewId,
            version: snapshot.view.version,
            instruction: args.instruction,
            nodeHints: patchContext.nodeHints,
            compactTree: patchContext.compactTree,
            detachedFields,
          }),
          'Planner-selected localized targets:',
          JSON.stringify(selectedTargets, null, 2),
        ].join('\n\n'),
        ...getPatchGenerateOptions(args.provider),
      });
      const patchParsed = patchResult.json ?? parseJson(patchResult.text);

      if (isViewPatchPlan(patchParsed)) {
        if (
          applyPatchPlanThroughUpdateParts(
            args.session,
            args.provider.label,
            snapshot.view,
            patchParsed
          )
        ) {
          return {
            result: patchResult,
            parsed: patchParsed,
            status: `Planner chose patch mode and applied localized Continuum update operations to ${snapshot.view.viewId}@${snapshot.view.version} from ${args.provider.label}.`,
          };
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

  const generateFullView = async (
    mode: PromptMode,
    validationErrors?: string[]
  ): Promise<StarterKitRunViewGenerationResult> => {
    const systemPrompt = useViewDsl
      ? buildViewAuthoringSystemPrompt({
          format: authoringFormat,
          mode,
          addons: args.addons,
        })
      : '';

    const userMessage = useViewDsl
      ? buildViewAuthoringUserMessage({
          format: authoringFormat,
          mode,
          instruction: args.instruction,
          currentView: mode === 'create-view' ? undefined : snapshot.view,
          detachedFields: mode === 'create-view' ? undefined : detachedFields,
          validationErrors,
          runtimeErrors:
            mode === 'correction-loop'
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
        const identityResult = normalizeContinuumSemanticIdentity({
          currentView: snapshot.view,
          nextView: parsed,
        });
        candidateErrors.push(...identityResult.errors);
        const unsupported = collectUnsupportedNodeTypes(parsed.nodes);
        if (unsupported.length > 0) {
          candidateErrors.push(
            `Unsupported node types: ${unsupported.join(', ')}.`
          );
        }
        candidateErrors.push(...collectStructuralErrors(parsed.nodes));
      }

      if (candidateErrors.length > 0) {
        finalResult = await args.provider.generate({
          systemPrompt: useViewDsl
            ? buildViewAuthoringSystemPrompt({
                format: authoringFormat,
                mode: 'correction-loop',
                addons: args.addons,
              })
            : '',
          userMessage: useViewDsl
            ? buildViewAuthoringUserMessage({
                format: authoringFormat,
                mode: 'correction-loop',
                instruction: args.instruction,
                currentView: snapshot.view,
                detachedFields,
                validationErrors: candidateErrors.slice(0, 8),
                runtimeErrors: buildRuntimeErrors(issues),
              })
            : '',
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
      const normalizedView = normalizeGeneratedView(snapshot.view, parsed);
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
  };

  return generateFullView(fullRunMode);
}
