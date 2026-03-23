import { parseJson } from '../../../view-guardrails/index.js';
import {
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  normalizeViewPatchPlan,
  VIEW_PATCH_OUTPUT_CONTRACT,
} from '../../../view-patching/index.js';
import { looksLikeStructuralEditInstruction } from '../instruction/instruction-heuristics.js';
import { createNoopResult } from '../trace/noop-result.js';
import { runGenerate } from '../trace/trace.js';
import type {
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionRequest,
} from '../../types.js';
import type { StreamContinuumExecutionEnv } from '../stream-execution-types.js';

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
    'The previous JSON did not yield usable patch operations. Return mode="patch" with a non-empty operations array using only supported kinds, valid existing node ids from the index, or mode="full" with fullStrategy if a full view change is required.';

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
    'Planner-selected localized targets:',
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
    const firstOp = Array.isArray((rawPatchValue as { operations?: unknown })?.operations)
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
    rawPatchPlan.mode === 'patch' &&
    Array.isArray(rawPatchPlan.operations) &&
    rawPatchPlan.operations.length === 0;

  const patchLooksEmpty =
    (parsedPatch?.mode === 'patch' && parsedPatch.operations.length === 0) ||
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
      source: env.args.adapter.label,
      status: `Applied localized Continuum patch operations from ${env.args.adapter.label}.`,
      level: 'success',
      trace: env.trace,
      currentView,
      patchPlan: parsedPatch,
      parsed: parsedPatch,
    };
  }

  const status = 'Patch update could not be applied; no changes were made.';
  const reason =
    normalizedPatch.reason ??
    (parsedPatch?.mode === 'full'
      ? parsedPatch.reason?.trim() ||
        (parsedPatch.fullStrategy === 'replace'
          ? 'Patch response requested a full view replacement instead of localized operations.'
          : 'Patch response requested full view regeneration instead of localized operations.')
      : 'Patch mode did not yield a usable localized update.');

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
