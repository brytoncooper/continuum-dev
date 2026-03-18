import type { SessionStreamPart, ViewDefinition } from '@continuum-dev/core';
import {
  type PromptMode,
  VIEW_DEFINITION_OUTPUT_CONTRACT,
} from '@continuum-dev/prompts';
import {
  buildContinuumExecutionPlannerSystemPrompt,
  buildContinuumExecutionPlannerUserPrompt,
  getAvailableContinuumExecutionModes,
  resolveContinuumExecutionPlan,
} from '../continuum-execution/index.mjs';
import {
  buildContinuumPatchTargetCatalog,
  buildContinuumStateTargetCatalog,
  parseContinuumStateResponse,
  type ContinuumExecutionTarget,
} from '../execution-targets/index.js';
import type { ContinuumSessionAdapter } from '../session/index.js';
import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
} from '../view-authoring/index.js';
import {
  normalizeViewDefinition,
  parseJson,
} from '../view-guardrails/index.js';
import {
  applyPatchPlanToView,
  buildDetachedFieldHints,
  buildPatchContext,
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  isViewPatchPlan,
  VIEW_PATCH_OUTPUT_CONTRACT,
  type ViewPatchPlan,
} from '../view-patching/index.js';
import {
  applyPatchPlanThroughUpdateParts,
  applyStateUpdatesThroughStreamingFoundation,
  applyThroughStreamingFoundation,
} from '../view-generation/apply.js';
import {
  buildRuntimeErrors,
  collectCandidateViewErrors,
  normalizeGeneratedView,
} from '../view-generation/normalize.js';
import type {
  ContinuumExecutionAdapter,
  ContinuumExecutionContext,
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
  ContinuumExecutionTraceEntry,
  StreamContinuumExecutionArgs,
} from './types.js';

export type {
  ContinuumExecutionAdapter,
  ContinuumExecutionContext,
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionOutputKind,
  ContinuumExecutionPhase,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
  ContinuumExecutionStatusLevel,
  ContinuumExecutionTraceEntry,
  StreamContinuumExecutionArgs,
} from './types.js';

interface SelectedExecutionPlan {
  mode: 'state' | 'patch' | 'view';
  fallback: string;
  reason?: string;
  targetNodeIds: string[];
  targetSemanticKeys: string[];
  validation: string;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function inferPromptMode(
  requestedMode: PromptMode | undefined,
  currentView: ViewDefinition | undefined
): PromptMode {
  if (requestedMode) {
    return requestedMode;
  }

  return currentView?.nodes.length ? 'evolve-view' : 'create-view';
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
  stateTargets: ContinuumExecutionTarget[];
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

function toTraceEntry(
  phase: ContinuumExecutionRequest['mode'],
  request: ContinuumExecutionRequest,
  response: ContinuumExecutionResponse
): ContinuumExecutionTraceEntry {
  return {
    phase,
    request,
    response,
  };
}

async function runGenerate(
  adapter: ContinuumExecutionAdapter,
  request: ContinuumExecutionRequest,
  trace: ContinuumExecutionTraceEntry[]
): Promise<ContinuumExecutionResponse> {
  const response = await adapter.generate(request);
  trace.push(toTraceEntry(request.mode, request, response));
  return response;
}

function normalizePatchPlan(rawPlan: unknown): ViewPatchPlan | null {
  if (!isViewPatchPlan(rawPlan)) {
    return null;
  }

  return rawPlan;
}

function normalizePreviewView(
  currentView: ViewDefinition | undefined,
  candidateView: ViewDefinition
): ViewDefinition | null {
  try {
    if (currentView) {
      return normalizeGeneratedView(currentView, candidateView);
    }

    return normalizeViewDefinition(candidateView);
  } catch {
    return null;
  }
}

function shouldAttemptPreview(
  nextView: ViewDefinition,
  lastPreviewSignature: string | null
): boolean {
  const signature = JSON.stringify(nextView);
  return signature !== lastPreviewSignature;
}

function finalizeGeneratedView(args: {
  currentView?: ViewDefinition;
  candidateView: ViewDefinition;
}): ViewDefinition {
  if (args.currentView) {
    return normalizeGeneratedView(args.currentView, args.candidateView);
  }

  return normalizeViewDefinition(args.candidateView);
}

async function repairGeneratedView(args: {
  adapter: ContinuumExecutionAdapter;
  trace: ContinuumExecutionTraceEntry[];
  authoringFormat: StreamContinuumExecutionArgs['authoringFormat'];
  instruction: string;
  mode: PromptMode;
  addons: StreamContinuumExecutionArgs['addons'];
  currentView?: ViewDefinition;
  detachedFields?: ContinuumExecutionContext['detachedFields'];
  issues?: ContinuumExecutionContext['issues'];
  validationErrors: string[];
}): Promise<ViewDefinition | null> {
  if (!args.currentView) {
    return null;
  }

  const repairRequest: ContinuumExecutionRequest = {
    systemPrompt: buildViewAuthoringSystemPrompt({
      format: args.authoringFormat ?? 'line-dsl',
      mode: 'correction-loop',
      addons: args.addons,
    }),
    userMessage: buildViewAuthoringUserMessage({
      format: args.authoringFormat ?? 'line-dsl',
      mode: 'correction-loop',
      instruction: args.instruction,
      currentView: args.currentView,
      detachedFields: args.detachedFields,
      validationErrors: args.validationErrors,
      runtimeErrors: buildRuntimeErrors(args.issues ?? []),
    }),
    mode: 'repair',
    outputKind: 'text',
    outputContract: VIEW_DEFINITION_OUTPUT_CONTRACT,
    temperature: 0,
  };

  const repairResponse = await runGenerate(
    args.adapter,
    repairRequest,
    args.trace
  );
  const repairedView = parseViewAuthoringToViewDefinition({
    format: args.authoringFormat ?? 'line-dsl',
    text: repairResponse.text,
    fallbackView: args.currentView,
  });
  if (!repairedView) {
    return null;
  }

  try {
    return finalizeGeneratedView({
      currentView: args.currentView,
      candidateView: repairedView,
    });
  } catch {
    return null;
  }
}

export function buildContinuumExecutionContext(
  session: ContinuumSessionAdapter
): ContinuumExecutionContext {
  const snapshot = session.getSnapshot();

  return {
    currentView: snapshot?.view,
    currentData: snapshot?.data.values,
    detachedFields: buildDetachedFieldHints(session.getDetachedValues()),
    issues: session.getIssues(),
  };
}

export async function* streamContinuumExecution(
  args: StreamContinuumExecutionArgs
): AsyncGenerator<ContinuumExecutionEvent, ContinuumExecutionFinalResult> {
  const trace: ContinuumExecutionTraceEntry[] = [];
  const currentView = args.context?.currentView;
  const currentData = args.context?.currentData ?? {};
  const detachedFields = args.context?.detachedFields ?? [];
  const issues = args.context?.issues ?? [];
  const authoringFormat = args.authoringFormat ?? 'line-dsl';
  const promptMode = inferPromptMode(args.mode, currentView);
  const autoApplyView = args.autoApplyView ?? true;

  try {
    const stateTargets = currentView
      ? buildContinuumStateTargetCatalog(currentView)
      : [];
    const patchTargets = currentView
      ? buildContinuumPatchTargetCatalog(currentView)
      : [];
    const patchContext = currentView
      ? buildPatchContext(currentView)
      : { nodeHints: [], compactTree: [] };
    const availableExecutionModes = getAvailableContinuumExecutionModes({
      hasCurrentView: Boolean(currentView?.nodes.length),
      hasStateTargets: stateTargets.length > 0,
    });

    let executionPlan: SelectedExecutionPlan = {
      mode: availableExecutionModes[0] ?? 'view',
      fallback: 'view',
      reason: autoApplyView
        ? 'only available mode'
        : 'view generation requested',
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: 'accepted',
    };

    if (autoApplyView && availableExecutionModes.length > 1) {
      yield {
        kind: 'status',
        status: 'Planning the best Continuum execution path for this request.',
        level: 'info',
      };

      const plannerRequest: ContinuumExecutionRequest = {
        systemPrompt: buildContinuumExecutionPlannerSystemPrompt(),
        userMessage: buildContinuumExecutionPlannerUserPrompt({
          availableModes: availableExecutionModes,
          patchTargets,
          stateTargets,
          compactTree: patchContext.compactTree,
          currentData,
          instruction: args.instruction,
        }),
        mode: 'planner',
        outputKind: 'json-object',
        temperature: 0,
        maxTokens: 512,
      };
      const plannerResponse = await runGenerate(
        args.adapter,
        plannerRequest,
        trace
      );

      executionPlan = resolveContinuumExecutionPlan({
        text: plannerResponse.text,
        availableModes: availableExecutionModes,
        patchTargets,
        stateTargets,
      });
    }

    yield {
      kind: 'status',
      status: `Planner chose ${executionPlan.mode} mode${
        executionPlan.reason ? `: ${executionPlan.reason}.` : '.'
      }`,
      level: 'info',
    };

    const selectedTargets = [
      ...executionPlan.targetNodeIds,
      ...executionPlan.targetSemanticKeys,
    ];

    if (executionPlan.mode === 'state' && currentView) {
      const stateRequest: ContinuumExecutionRequest = {
        systemPrompt: buildStateSystemPrompt(),
        userMessage: buildStateUserMessage({
          instruction: args.instruction,
          currentData,
          stateTargets,
          selectedTargets,
        }),
        mode: 'state',
        outputKind: 'json-object',
        temperature: 0,
      };
      const stateResponse = await runGenerate(
        args.adapter,
        stateRequest,
        trace
      );
      const parsedState = parseContinuumStateResponse({
        text: stateResponse.text,
        targetCatalog: stateTargets,
      });

      if (parsedState && parsedState.updates.length > 0) {
        for (const update of parsedState.updates) {
          yield {
            kind: 'state',
            currentView,
            update,
          };
        }

        return {
          mode: 'state',
          source: args.adapter.label,
          status:
            parsedState.status ??
            `Applied ${parsedState.updates.length} Continuum state update${
              parsedState.updates.length === 1 ? '' : 's'
            } from ${args.adapter.label}.`,
          trace,
          currentView,
          updates: parsedState.updates,
          parsed: parsedState,
        };
      }

      yield {
        kind: 'status',
        status:
          'State mode did not yield valid updates, so Continuum is regenerating the next view instead.',
        level: 'warning',
      };
    }

    let nextPromptMode = promptMode;

    if (executionPlan.mode === 'patch' && currentView) {
      const patchRequest: ContinuumExecutionRequest = {
        systemPrompt: buildPatchSystemPrompt(),
        userMessage: [
          buildPatchUserMessage({
            viewId: currentView.viewId,
            version: currentView.version,
            instruction: args.instruction,
            nodeHints: patchContext.nodeHints,
            compactTree: patchContext.compactTree,
            detachedFields,
          }),
          'Planner-selected localized targets:',
          JSON.stringify(selectedTargets, null, 2),
        ].join('\n\n'),
        mode: 'patch',
        outputKind: 'json-object',
        outputContract: VIEW_PATCH_OUTPUT_CONTRACT,
        temperature: 0,
      };
      const patchResponse = await runGenerate(
        args.adapter,
        patchRequest,
        trace
      );
      const parsedPatch = normalizePatchPlan(
        patchResponse.json ?? parseJson<unknown>(patchResponse.text)
      );

      if (
        parsedPatch &&
        parsedPatch.mode === 'patch' &&
        parsedPatch.operations.length > 0
      ) {
        yield {
          kind: 'patch',
          currentView,
          patchPlan: parsedPatch,
        };

        return {
          mode: 'patch',
          source: args.adapter.label,
          status: `Applied localized Continuum patch operations from ${args.adapter.label}.`,
          trace,
          currentView,
          patchPlan: parsedPatch,
          parsed: parsedPatch,
        };
      }

      if (
        parsedPatch &&
        parsedPatch.mode === 'full' &&
        parsedPatch.fullStrategy === 'replace'
      ) {
        nextPromptMode = 'create-view';
      }

      yield {
        kind: 'status',
        status:
          'Patch mode was not safe to apply, so Continuum is generating the next full view instead.',
        level: 'warning',
      };
    }

    const fullViewRequest: ContinuumExecutionRequest = {
      systemPrompt: buildViewAuthoringSystemPrompt({
        format: authoringFormat,
        mode: nextPromptMode,
        addons: args.addons,
      }),
      userMessage: buildViewAuthoringUserMessage({
        format: authoringFormat,
        mode: nextPromptMode,
        instruction: args.instruction,
        currentView:
          nextPromptMode === 'create-view' ? undefined : currentView,
        detachedFields:
          nextPromptMode === 'create-view' ? undefined : detachedFields,
        runtimeErrors:
          nextPromptMode === 'correction-loop'
            ? buildRuntimeErrors(issues)
            : undefined,
      }),
      mode: 'view',
      outputKind: 'text',
      outputContract: VIEW_DEFINITION_OUTPUT_CONTRACT,
    };

    let finalViewText = '';
    let lastPreviewSignature: string | null = null;

    if (typeof args.adapter.streamText === 'function') {
      const textStream = args.adapter.streamText(fullViewRequest);

      for await (const chunk of textStream) {
        finalViewText += chunk;
        const previewCandidate = parseViewAuthoringToViewDefinition({
          format: authoringFormat,
          text: finalViewText,
          fallbackView: currentView,
        });
        if (!previewCandidate) {
          continue;
        }

        const previewView = normalizePreviewView(currentView, previewCandidate);
        if (!previewView || !shouldAttemptPreview(previewView, lastPreviewSignature)) {
          continue;
        }

        lastPreviewSignature = JSON.stringify(previewView);
        yield {
          kind: 'view-preview',
          view: previewView,
        };
      }

      const streamedViewResponse: ContinuumExecutionResponse = {
        text: finalViewText,
        raw: finalViewText,
      };
      trace.push(toTraceEntry('view', fullViewRequest, streamedViewResponse));
    } else {
      finalViewText = (
        await runGenerate(args.adapter, fullViewRequest, trace)
      ).text;
    }

    const parsedView = parseViewAuthoringToViewDefinition({
      format: authoringFormat,
      text: finalViewText,
      fallbackView: currentView,
    });

    let finalView: ViewDefinition | null = null;
    let validationErrors: string[] = [];

    if (parsedView) {
      try {
        finalView = finalizeGeneratedView({
          currentView,
          candidateView: parsedView,
        });
      } catch (error) {
        validationErrors = [normalizeError(error).message];
      }
    } else {
      validationErrors = ['Model output did not compile into a valid ViewDefinition.'];
    }

    if (!finalView && currentView) {
      if (validationErrors.length === 0 && parsedView) {
        validationErrors = collectCandidateViewErrors(currentView, parsedView);
      }

      yield {
        kind: 'status',
        status:
          'The generated view was invalid, so Continuum is repairing it before apply.',
        level: 'warning',
      };

      finalView = await repairGeneratedView({
        adapter: args.adapter,
        trace,
        authoringFormat,
        instruction: args.instruction,
        mode: nextPromptMode,
        addons: args.addons,
        currentView,
        detachedFields,
        issues,
        validationErrors,
      });
    }

    if (!finalView) {
      throw new Error(
        validationErrors[0] ??
          'The model response did not produce a valid Continuum view.'
      );
    }

    yield {
      kind: 'view-final',
      view: finalView,
    };

    return {
      mode: 'view',
      source: args.adapter.label,
      status: `Generated a Continuum view from ${args.adapter.label}.`,
      trace,
      view: finalView,
      parsed: finalView,
    };
  } catch (error) {
    const normalized = normalizeError(error);
    yield {
      kind: 'error',
      message: normalized.message,
      error: normalized,
    };
    throw normalized;
  }
}

export async function runContinuumExecution(
  args: StreamContinuumExecutionArgs
): Promise<ContinuumExecutionFinalResult> {
  const iterator = streamContinuumExecution(args);
  let next = await iterator.next();

  while (!next.done) {
    next = await iterator.next();
  }

  return next.value;
}

export function applyContinuumExecutionFinalResult(
  session: ContinuumSessionAdapter,
  result: ContinuumExecutionFinalResult
): void {
  if (result.mode === 'state') {
    if (
      applyStateUpdatesThroughStreamingFoundation(
        session,
        result.source,
        result.currentView,
        result.updates
      )
    ) {
      return;
    }

    for (const update of result.updates) {
      session.proposeValue(update.nodeId, update.value, result.source);
    }
    return;
  }

  if (result.mode === 'patch') {
    if (
      applyPatchPlanThroughUpdateParts(
        session,
        result.source,
        result.currentView,
        result.patchPlan
      )
    ) {
      return;
    }

    const nextView = applyPatchPlanToView(result.currentView, result.patchPlan);
    if (!nextView) {
      throw new Error('Unable to apply the generated Continuum patch plan.');
    }

    session.applyView(nextView);
    return;
  }

  const viewPart: SessionStreamPart = {
    kind: 'view',
    view: result.view,
  };

  if (
    applyThroughStreamingFoundation(
      session,
      result.source,
      result.view.viewId,
      [viewPart],
      'draft'
    )
  ) {
    return;
  }

  session.applyView(result.view);
}
