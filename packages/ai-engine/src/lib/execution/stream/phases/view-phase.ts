import {
  type PromptMode,
  VIEW_DEFINITION_OUTPUT_CONTRACT,
} from '@continuum-dev/prompts';
import type { ViewDefinition } from '@continuum-dev/core';
import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
} from '../../../view-authoring/index.js';
import {
  buildRuntimeErrors,
  collectCandidateViewErrors,
} from '../../../view-generation/normalize/normalize.js';
import {
  normalizePreviewView,
  shouldAttemptPreview,
} from '../preview/preview-normalize.js';
import { viewPassesPreviewQualityGate } from '../preview/preview-quality-gate.js';
import { finalizeGeneratedView } from '../preview/view-finalize.js';
import { repairGeneratedView } from '../preview/view-repair.js';
import {
  buildViewEvaluationErrors,
  evaluateRuntimeViewTransition,
} from '../evaluation/runtime-view-evaluator.js';
import { createExecutionTraceId } from '../trace/create-trace-id.js';
import { createNoopResult } from '../trace/noop-result.js';
import { normalizeError } from '../trace/normalize-error.js';
import { runGenerate, toTraceEntry } from '../trace/trace.js';
import type {
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
} from '../../types.js';
import type { StreamContinuumExecutionEnv } from '../stream-execution-types.js';
import type { ViewEvolutionDiagnostics } from '@continuum-dev/protocol';

const DEFAULT_VIEW_PREVIEW_THROTTLE_MS = 600;

function buildRegisteredIntentIds(
  registered: StreamContinuumExecutionEnv['registeredActions']
): ReadonlySet<string> | undefined {
  if (!registered || Object.keys(registered).length === 0) {
    return undefined;
  }
  return new Set(Object.keys(registered));
}

export async function* runViewPhase(
  env: StreamContinuumExecutionEnv,
  nextPromptMode: PromptMode
): AsyncGenerator<ContinuumExecutionEvent, ContinuumExecutionFinalResult> {
  const structuredViewJson = env.authoringFormat === 'view-json';

  const fullViewRequest: ContinuumExecutionRequest = env.attach({
    systemPrompt: buildViewAuthoringSystemPrompt({
      format: env.authoringFormat,
      mode: nextPromptMode,
      addons: env.args.addons,
    }),
    userMessage: buildViewAuthoringUserMessage({
      format: env.authoringFormat,
      mode: nextPromptMode,
      instruction: env.args.instruction,
      currentView: nextPromptMode === 'create-view' ? undefined : env.currentView,
      detachedFields:
        nextPromptMode === 'create-view' ? undefined : env.detachedFields,
      conversationSummary: env.conversationSummary || undefined,
      runtimeErrors:
        nextPromptMode === 'correction-loop'
          ? buildRuntimeErrors(env.issues)
          : undefined,
      integrationBinding:
        env.integrationBinding.trim().length > 0
          ? env.integrationBinding
          : undefined,
    }),
    mode: 'view',
    outputKind: structuredViewJson ? 'json-object' : 'text',
    outputContract: VIEW_DEFINITION_OUTPUT_CONTRACT,
  });

  let finalViewText = '';
  let finalViewJson: unknown | undefined;
  let lastPreviewSignature: string | null = null;

  if (structuredViewJson) {
    const viewResponse = await runGenerate(
      env.args.adapter,
      fullViewRequest,
      env.trace
    );
    finalViewText = viewResponse.text;
    finalViewJson = viewResponse.json ?? undefined;
  } else if (typeof env.args.adapter.streamText === 'function') {
    const textStream = env.args.adapter.streamText(fullViewRequest);
    const emitPreviews = env.args.emitViewPreviews !== false;
    const throttleMs =
      env.args.viewPreviewThrottleMs !== undefined
        ? env.args.viewPreviewThrottleMs
        : DEFAULT_VIEW_PREVIEW_THROTTLE_MS;

    if (!emitPreviews) {
      for await (const chunk of textStream) {
        finalViewText += chunk;
      }
    } else if (throttleMs <= 0) {
      for await (const chunk of textStream) {
        finalViewText += chunk;
        const previewCandidate = parseViewAuthoringToViewDefinition({
          format: env.authoringFormat,
          text: finalViewText,
          fallbackView: env.currentView,
        });
        if (!previewCandidate) {
          continue;
        }

        const previewView = normalizePreviewView(
          env.currentView,
          previewCandidate
        );
        if (
          !previewView ||
          !shouldAttemptPreview(previewView, lastPreviewSignature)
        ) {
          continue;
        }

        lastPreviewSignature = JSON.stringify(previewView);
        yield {
          kind: 'view-preview',
          view: previewView,
        };
      }
    } else {
      let lastPreviewEmitAt: number | null = null;
      let pendingPreviewView: ViewDefinition | null = null;

      for await (const chunk of textStream) {
        finalViewText += chunk;
        const previewCandidate = parseViewAuthoringToViewDefinition({
          format: env.authoringFormat,
          text: finalViewText,
          fallbackView: env.currentView,
        });
        if (!previewCandidate) {
          continue;
        }

        const previewView = normalizePreviewView(
          env.currentView,
          previewCandidate
        );
        if (
          !previewView ||
          !viewPassesPreviewQualityGate(previewView) ||
          !shouldAttemptPreview(previewView, lastPreviewSignature)
        ) {
          continue;
        }

        const signature = JSON.stringify(previewView);
        pendingPreviewView = previewView;
        const now = Date.now();
        const allowEmit =
          lastPreviewEmitAt === null || now - lastPreviewEmitAt >= throttleMs;
        if (allowEmit) {
          lastPreviewSignature = signature;
          lastPreviewEmitAt = now;
          yield {
            kind: 'view-preview',
            view: previewView,
          };
          pendingPreviewView = null;
        }
      }

      if (pendingPreviewView !== null) {
        const pendingSig = JSON.stringify(pendingPreviewView);
        if (pendingSig !== lastPreviewSignature) {
          yield {
            kind: 'view-preview',
            view: pendingPreviewView,
          };
        }
      }
    }

    const streamedViewResponse: ContinuumExecutionResponse = {
      text: finalViewText,
      raw: finalViewText,
    };
    env.trace.push(toTraceEntry('view', fullViewRequest, streamedViewResponse));
  } else {
    const viewResponse = await runGenerate(
      env.args.adapter,
      fullViewRequest,
      env.trace
    );
    finalViewText = viewResponse.text;
    finalViewJson = viewResponse.json ?? undefined;
  }

  const parsedView = parseViewAuthoringToViewDefinition({
    format: env.authoringFormat,
    text: finalViewText,
    json: structuredViewJson ? finalViewJson : undefined,
    fallbackView: env.currentView,
  });

  let finalView: ViewDefinition | null = null;
  let validationErrors: string[] = [];
  let viewEvolutionDiagnostics: ViewEvolutionDiagnostics | undefined;

  if (parsedView) {
    try {
      finalView = finalizeGeneratedView({
        currentView: env.currentView,
        candidateView: parsedView,
      });
    } catch (error) {
      validationErrors = [normalizeError(error).message];
    }
  } else {
    validationErrors = [
      'Model output did not compile into a valid ViewDefinition.',
    ];
  }

  if (!finalView && env.currentView) {
    if (validationErrors.length === 0 && parsedView) {
      validationErrors = collectCandidateViewErrors(env.currentView, parsedView);
    }

    yield {
      kind: 'status',
      status:
        'The generated view was invalid, so Continuum is repairing it before apply.',
      level: 'warning',
    };

    finalView = await repairGeneratedView({
      adapter: env.args.adapter,
      trace: env.trace,
      authoringFormat: env.authoringFormat,
      instruction: env.args.instruction,
      mode: nextPromptMode,
      addons: env.args.addons,
      currentView: env.currentView,
      detachedFields: env.detachedFields,
      issues: env.issues,
      validationErrors,
      integrationBinding:
        env.integrationBinding.trim().length > 0
          ? env.integrationBinding
          : undefined,
      attachments: env.chatAttachments,
    });
  }

  if (!finalView) {
    throw new Error(
      validationErrors[0] ??
        'The model response did not produce a valid Continuum view.'
    );
  }

  if (env.currentView) {
    let evaluation = evaluateRuntimeViewTransition({
      currentView: env.currentView,
      nextView: finalView,
      currentData: env.currentData,
      detachedFields: env.detachedFields,
      registeredIntentIds: buildRegisteredIntentIds(env.registeredActions),
      rejectOptions:
        nextPromptMode === 'create-view'
          ? { ignoreReplacementRatio: true }
          : undefined,
    });
    viewEvolutionDiagnostics = evaluation.diagnostics;

    if (evaluation.rejectionReason) {
      env.args.onEditTrace?.({
        traceId: createExecutionTraceId(),
        phase: 'view',
        priorViewId: env.currentView.viewId,
        instruction: env.args.instruction,
        scopedBrief: env.scopedEditBrief,
        accepted: false,
        diagnostics: viewEvolutionDiagnostics,
        rejectionReason: evaluation.rejectionReason,
      });

      yield {
        kind: 'status',
        status:
          'The generated view failed runtime continuity evaluation, so Continuum is repairing it before apply.',
        level: 'warning',
      };

      const repairedView = await repairGeneratedView({
        adapter: env.args.adapter,
        trace: env.trace,
        authoringFormat: env.authoringFormat,
        instruction: env.args.instruction,
        mode: nextPromptMode,
        addons: env.args.addons,
        currentView: env.currentView,
        detachedFields: env.detachedFields,
        issues: env.issues,
        validationErrors:
          viewEvolutionDiagnostics
            ? buildViewEvaluationErrors(viewEvolutionDiagnostics)
            : [evaluation.rejectionReason],
        integrationBinding:
          env.integrationBinding.trim().length > 0
            ? env.integrationBinding
            : undefined,
        attachments: env.chatAttachments,
      });

      if (!repairedView) {
        return createNoopResult({
          source: env.args.adapter.label,
          status:
            'View update could not be applied after runtime evaluation retry.',
          reason: evaluation.rejectionReason,
          requestedMode: 'view',
          trace: env.trace,
        });
      }

      evaluation = evaluateRuntimeViewTransition({
        currentView: env.currentView,
        nextView: repairedView,
        currentData: env.currentData,
        detachedFields: env.detachedFields,
        registeredIntentIds: buildRegisteredIntentIds(env.registeredActions),
        rejectOptions:
          nextPromptMode === 'create-view'
            ? { ignoreReplacementRatio: true }
            : undefined,
      });
      viewEvolutionDiagnostics = evaluation.diagnostics;

      if (evaluation.rejectionReason) {
        return createNoopResult({
          source: env.args.adapter.label,
          status:
            'View update could not be applied; runtime evaluation failed.',
          reason: evaluation.rejectionReason,
          requestedMode: 'view',
          trace: env.trace,
        });
      }

      finalView = evaluation.appliedState.view;
    } else {
      finalView = evaluation.appliedState.view;
    }
  }

  if (env.currentView) {
    env.args.onEditTrace?.({
      traceId: createExecutionTraceId(),
      phase: 'view',
      priorViewId: env.currentView.viewId,
      instruction: env.args.instruction,
      scopedBrief: env.scopedEditBrief,
      accepted: true,
      diagnostics: viewEvolutionDiagnostics,
    });
  }

  yield {
    kind: 'view-final',
    view: finalView,
  };

  return {
    mode: 'view',
    source: env.args.adapter.label,
    status: `Generated a Continuum view from ${env.args.adapter.label}.`,
    level: 'success',
    trace: env.trace,
    view: finalView,
    parsed: finalView,
    viewEvolutionDiagnostics,
  };
}
