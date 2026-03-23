import type { ViewDefinition } from '@continuum-dev/core';
import { parseJson } from '../../../view-guardrails/index.js';
import {
  applyPatchPlanToView,
  normalizeViewPatchPlan,
} from '../../../view-patching/index.js';
import {
  buildSurgicalTransformSystemPrompt,
  buildSurgicalTransformUserMessage,
  normalizeSurgicalTransformPlan,
} from '../../../view-transforms/index.js';
import { createNoopResult } from '../trace/noop-result.js';
import { runGenerate } from '../trace/trace.js';
import type {
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
} from '../../types.js';
import type { StreamContinuumExecutionEnv } from '../stream-execution-types.js';

export async function* runTransformPhase(
  env: StreamContinuumExecutionEnv
): AsyncGenerator<
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult | undefined
> {
  const { executionPlan, currentView } = env;
  if (executionPlan.mode !== 'transform' || !currentView) {
    return undefined;
  }

  yield {
    kind: 'status',
    status: 'Generating surgical transform plan.',
    level: 'info',
  };

  const surgicalRequest = env.attach({
    systemPrompt: buildSurgicalTransformSystemPrompt(),
    userMessage: [
      buildSurgicalTransformUserMessage({
        instruction: env.args.instruction,
        currentView,
        currentData: env.currentData,
        selectedTargets: env.selectedTargets,
        conversationSummary: env.conversationSummary || undefined,
      }),
      env.integrationBinding.trim().length > 0 ? env.integrationBinding : '',
    ]
      .filter(
        (section) => typeof section === 'string' && section.trim().length > 0
      )
      .join('\n\n'),
    mode: 'transform',
    outputKind: 'json-object',
    temperature: 0,
  });
  const surgicalResponse = await runGenerate(
    env.args.adapter,
    surgicalRequest,
    env.trace
  );
  const normalizedSurgical = normalizeSurgicalTransformPlan(
    surgicalResponse.json ?? parseJson<unknown>(surgicalResponse.text),
    currentView
  );

  if (normalizedSurgical.plan) {
    const { patchOperations, continuityOperations } = normalizedSurgical.plan;

    let nextView: ViewDefinition | null = null;
    if (patchOperations.length > 0) {
      const patchPlan = normalizeViewPatchPlan({
        mode: 'patch' as const,
        operations: patchOperations,
      });

      if (patchPlan.plan && patchPlan.plan.mode === 'patch') {
        nextView = applyPatchPlanToView(currentView, patchPlan.plan);
      }
    }

    if (!nextView && patchOperations.length > 0) {
      const surgicalPatchStatus =
        'Surgical transform patch operations could not be applied.';
      yield {
        kind: 'status',
        status: surgicalPatchStatus,
        level: 'warning',
      };

      return createNoopResult({
        source: env.args.adapter.label,
        status: surgicalPatchStatus,
        reason:
          normalizedSurgical.reason ??
          'Surgical transform patch operations were invalid.',
        requestedMode: 'transform',
        trace: env.trace,
      });
    }

    const finalTransformView = nextView ?? currentView;
    const transformPlan =
      continuityOperations.length > 0
        ? { operations: continuityOperations }
        : undefined;

    yield {
      kind: 'view-final',
      view: finalTransformView,
      ...(transformPlan ? { transformPlan } : {}),
    };

    return {
      mode: 'transform' as const,
      source: env.args.adapter.label,
      status: `Applied surgical Continuum transform from ${env.args.adapter.label}.`,
      level: 'success' as const,
      trace: env.trace,
      view: finalTransformView,
      transformPlan: transformPlan ?? { operations: [] },
      parsed: {
        view: finalTransformView,
        transformPlan: transformPlan ?? { operations: [] },
      },
    };
  }

  const surgicalStatus =
    'Transform update could not be applied; no changes were made.';
  yield {
    kind: 'status',
    status: surgicalStatus,
    level: 'warning',
  };

  return createNoopResult({
    source: env.args.adapter.label,
    status: surgicalStatus,
    reason:
      normalizedSurgical.reason ??
      'Surgical transform did not yield a usable plan.',
    requestedMode: 'transform',
    trace: env.trace,
  });
}
