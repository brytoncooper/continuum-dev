import type { ViewDefinition } from '@continuum-dev/core';
import type { ViewEvolutionDiagnostics } from '@continuum-dev/protocol';
import { parseJson } from '../../../view-guardrails/index.js';
import {
  applyPatchPlanToView,
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  normalizeViewPatchPlan,
  VIEW_PATCH_OUTPUT_CONTRACT,
} from '../../../view-patching/index.js';
import { evaluateRuntimeViewTransition } from '../evaluation/runtime-view-evaluator.js';
import { looksLikeStructuralEditInstruction } from '../instruction/instruction-heuristics.js';
import { createExecutionTraceId } from '../trace/create-trace-id.js';
import { createNoopResult } from '../trace/noop-result.js';
import { runGenerate } from '../trace/trace.js';
import type {
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionRequest,
} from '../../types.js';
import type { StreamContinuumExecutionEnv } from '../stream-execution-types.js';

function buildRegisteredIntentIds(
  registered: StreamContinuumExecutionEnv['registeredActions']
): ReadonlySet<string> | undefined {
  if (!registered || Object.keys(registered).length === 0) {
    return undefined;
  }
  return new Set(Object.keys(registered));
}

export async function* runPatchPhase(
  env: StreamContinuumExecutionEnv
): AsyncGenerator<
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult | undefined
> {
  const { executionPlan, currentView } = env;
  if (executionPlan.mode !== 'patch' || !currentView) {
    return undefined;
  }

  const patchRetryFeedback =
    'The previous JSON did not yield usable patch operations. Retry with the smallest valid localized edit plan: return {"operations":[...]} with a non-empty operations array using only supported operation kinds and valid existing node ids from the index. If a localized patch is unsafe, return {"operations":[]} and optionally a short reason.';

  const patchMessageSections = [
    buildPatchUserMessage({
      viewId: currentView.viewId,
      version: currentView.version,
      instruction: env.args.instruction,
      nodeHints: env.patchContext.nodeHints,
      compactTree: env.patchContext.compactTree,
      detachedFields: env.detachedFields,
      conversationSummary: env.conversationSummary || undefined,
    }),
    'Selected localized targets:',
    JSON.stringify(env.selectedTargets, null, 2),
  ];
  if (env.integrationBinding.trim().length > 0) {
    patchMessageSections.push(env.integrationBinding);
  }

  const patchUserMessageBase = patchMessageSections.join('\n\n');

  const patchRequest: ContinuumExecutionRequest = env.attach({
    systemPrompt: buildPatchSystemPrompt(),
    userMessage: patchUserMessageBase,
    mode: 'patch',
    outputKind: 'json-object',
    outputContract: VIEW_PATCH_OUTPUT_CONTRACT,
    temperature: 0,
  });
  let patchResponse = await runGenerate(
    env.args.adapter,
    patchRequest,
    env.trace
  );
  let rawPatchValue =
    patchResponse.json ?? parseJson<unknown>(patchResponse.text);
  let normalizedPatch = normalizeViewPatchPlan(rawPatchValue);
  let parsedPatch = normalizedPatch.plan;

  if (!parsedPatch) {
    const firstOp = Array.isArray(
      (rawPatchValue as { operations?: unknown })?.operations
    )
      ? (rawPatchValue as { operations: unknown[] }).operations[0]
      : null;
    const opKeys =
      firstOp && typeof firstOp === 'object'
        ? JSON.stringify(firstOp).slice(0, 200)
        : 'no operations';
    yield {
      kind: 'status',
      status: `[debug] Patch normalization failed: ${
        normalizedPatch.reason ?? 'unknown reason'
      }. First op: ${opKeys}`,
      level: 'info',
    };
  }

  const rawPatchPlan =
    rawPatchValue && typeof rawPatchValue === 'object'
      ? (rawPatchValue as Record<string, unknown>)
      : null;
  const rawHadEmptyPatchOperations =
    rawPatchPlan &&
    Array.isArray(rawPatchPlan.operations) &&
    rawPatchPlan.operations.length === 0;

  const patchLooksEmpty =
    (parsedPatch !== null && parsedPatch.operations.length === 0) ||
    rawHadEmptyPatchOperations === true;

  if (
    patchLooksEmpty &&
    looksLikeStructuralEditInstruction(env.args.instruction)
  ) {
    yield {
      kind: 'status',
      status:
        'Patch response had no operations; retrying once with validation feedback.',
      level: 'info',
    };
    const patchRetryRequest: ContinuumExecutionRequest = env.attach({
      ...patchRequest,
      userMessage: `${patchUserMessageBase}\n\n${patchRetryFeedback}`,
    });
    patchResponse = await runGenerate(
      env.args.adapter,
      patchRetryRequest,
      env.trace
    );
    rawPatchValue =
      patchResponse.json ?? parseJson<unknown>(patchResponse.text);
    normalizedPatch = normalizeViewPatchPlan(rawPatchValue);
    parsedPatch = normalizedPatch.plan;
  }

  const emitEditTrace = (
    accepted: boolean,
    diagnostics: ViewEvolutionDiagnostics | undefined,
    rejectionReason?: string
  ) => {
    env.args.onEditTrace?.({
      traceId: createExecutionTraceId(),
      phase: 'patch',
      priorViewId: currentView.viewId,
      instruction: env.args.instruction,
      scopedBrief: env.scopedEditBrief,
      accepted,
      diagnostics,
      rejectionReason,
    });
  };

  const evaluateAppliedPatch = (
    priorView: ViewDefinition,
    plan: NonNullable<typeof parsedPatch>
  ):
    | {
        ok: true;
        nextView: ViewDefinition;
        diagnostics: ViewEvolutionDiagnostics;
      }
    | { ok: false; reason: string; diagnostics?: ViewEvolutionDiagnostics } => {
    const nextView = applyPatchPlanToView(priorView, plan);
    if (!nextView) {
      return {
        ok: false,
        reason: 'Patch operations did not apply to the current view.',
      };
    }
    const evaluation = evaluateRuntimeViewTransition({
      currentView: priorView,
      nextView,
      currentData: env.currentData,
      detachedFields: env.detachedFields,
      registeredIntentIds: buildRegisteredIntentIds(env.registeredActions),
    });
    if (evaluation.rejectionReason) {
      return {
        ok: false,
        reason: evaluation.rejectionReason,
        diagnostics: evaluation.diagnostics,
      };
    }
    return {
      ok: true,
      nextView: evaluation.appliedState.view,
      diagnostics: evaluation.diagnostics!,
    };
  };

  if (parsedPatch && parsedPatch.operations.length > 0) {
    let evalResult = evaluateAppliedPatch(currentView, parsedPatch);
    if (!evalResult.ok && evalResult.diagnostics) {
      yield {
        kind: 'status',
        status:
          'Patch rejected by runtime evaluation; retrying once with diagnostics feedback.',
        level: 'info',
      };
      const diagnosticRetryRequest: ContinuumExecutionRequest = env.attach({
        ...patchRequest,
        userMessage: `${patchUserMessageBase}\n\n${patchRetryFeedback}\n\nRuntime diagnostics (JSON):\n${JSON.stringify(
          evalResult.diagnostics
        )}`,
      });
      patchResponse = await runGenerate(
        env.args.adapter,
        diagnosticRetryRequest,
        env.trace
      );
      rawPatchValue =
        patchResponse.json ?? parseJson<unknown>(patchResponse.text);
      normalizedPatch = normalizeViewPatchPlan(rawPatchValue);
      parsedPatch = normalizedPatch.plan;
      if (parsedPatch && parsedPatch.operations.length > 0) {
        evalResult = evaluateAppliedPatch(currentView, parsedPatch);
      } else {
        emitEditTrace(false, evalResult.diagnostics, evalResult.reason);
        yield {
          kind: 'status',
          status:
            'Patch retry after runtime rejection did not yield a usable plan.',
          level: 'warning',
        };
        return createNoopResult({
          source: env.args.adapter.label,
          status:
            'Patch update could not be applied after runtime evaluation retry.',
          reason:
            normalizedPatch.reason ??
            'Patch mode did not yield a usable localized update.',
          requestedMode: 'patch',
          trace: env.trace,
        });
      }
    }

    if (!evalResult.ok) {
      emitEditTrace(
        false,
        evalResult.diagnostics,
        evalResult.reason
      );
      yield {
        kind: 'status',
        status: evalResult.reason,
        level: 'warning',
      };
      return createNoopResult({
        source: env.args.adapter.label,
        status: 'Patch update could not be applied; runtime evaluation failed.',
        reason: evalResult.reason,
        requestedMode: 'patch',
        trace: env.trace,
      });
    }

    emitEditTrace(true, evalResult.diagnostics);

    yield {
      kind: 'patch',
      currentView,
      patchPlan: parsedPatch,
    };

    return {
      mode: 'patch',
      source: env.args.adapter.label,
      status: `Applied localized Continuum patch operations from ${env.args.adapter.label}.`,
      level: 'success',
      trace: env.trace,
      currentView,
      patchPlan: parsedPatch,
      parsed: parsedPatch,
      viewEvolutionDiagnostics: evalResult.diagnostics,
    };
  }

  const status = 'Patch update could not be applied; no changes were made.';
  const reason =
    normalizedPatch.reason ?? 'Patch mode did not yield a usable localized update.';

  yield {
    kind: 'status',
    status,
    level: 'warning',
  };

  return createNoopResult({
    source: env.args.adapter.label,
    status,
    reason,
    requestedMode: 'patch',
    trace: env.trace,
  });
}
