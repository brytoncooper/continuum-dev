import {
  buildContinuumExecutionPlannerSystemPrompt,
  buildContinuumExecutionPlannerUserPrompt,
  buildIntegrationBindingParagraph,
  buildRegisteredActionsParagraph,
  resolveContinuumExecutionPlan,
} from '../../continuum-execution/index.mjs';
import { normalizeError } from './trace/normalize-error.js';
import { runGenerate } from './trace/trace.js';
import type {
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionRequest,
  StreamContinuumExecutionArgs,
} from '../types.js';
import { runPatchPhase } from './phases/patch-phase.js';
import { runStatePhase } from './phases/state-phase.js';
import { runTransformPhase } from './phases/transform-phase.js';
import { runViewPhase } from './phases/view-phase.js';
import { createStreamContinuumExecutionEnv } from './stream-execution-types.js';

export async function* streamContinuumExecution(
  args: StreamContinuumExecutionArgs
): AsyncGenerator<ContinuumExecutionEvent, ContinuumExecutionFinalResult> {
  const env = createStreamContinuumExecutionEnv(args);

  try {
    if (env.autoApplyView) {
      yield {
        kind: 'status',
        status: 'Planning the best Continuum execution path for this request.',
        level: 'info',
      };

      const plannerRequest: ContinuumExecutionRequest = env.attach({
        systemPrompt: buildContinuumExecutionPlannerSystemPrompt({
          hasRestoreContinuity: env.hasRestoreContinuity,
          integrationCatalog: env.integrationCatalog,
          registeredActions: env.registeredActions,
        }),
        userMessage: buildContinuumExecutionPlannerUserPrompt({
          availableModes: env.availableExecutionModes,
          patchTargets: env.patchTargets,
          stateTargets: env.stateTargets,
          compactTree: env.patchContext.compactTree,
          currentData: env.currentData as Record<string, unknown> | undefined,
          instruction: env.args.instruction,
          conversationSummary: env.conversationSummary || undefined,
          detachedFields: env.detachedFields,
          integrationCatalog: env.integrationCatalog,
          registeredActions: env.registeredActions,
        }),
        mode: 'planner',
        outputKind: 'json-object',
        temperature: 0,
        maxTokens: 512,
      });
      const plannerResponse = await runGenerate(
        env.args.adapter,
        plannerRequest,
        env.trace
      );

      env.executionPlan = resolveContinuumExecutionPlan({
        text: plannerResponse.text,
        availableModes: env.availableExecutionModes,
        patchTargets: env.patchTargets,
        stateTargets: env.stateTargets,
        integrationCatalog: env.integrationCatalog,
      });
    }

    const endpointSchemaBinding = buildIntegrationBindingParagraph({
      integrationCatalog: env.integrationCatalog,
      endpointId: env.executionPlan.endpointId,
      payloadSemanticKeys: env.executionPlan.payloadSemanticKeys,
    });
    const actionsBinding = buildRegisteredActionsParagraph({
      registeredActions: env.registeredActions,
    });
    env.integrationBinding = [endpointSchemaBinding, actionsBinding]
      .filter(
        (section) => typeof section === 'string' && section.trim().length > 0
      )
      .join('\n\n');

    yield {
      kind: 'status',
      status: `Planner chose ${env.executionPlan.mode} mode${
        env.executionPlan.reason ? `: ${env.executionPlan.reason}.` : '.'
      }${
        env.executionPlan.endpointId
          ? ` Integration endpoint: ${env.executionPlan.endpointId}.`
          : ''
      }`,
      level: 'info',
    };

    if (
      env.integrationCatalog &&
      env.executionPlan.integrationValidation &&
      env.executionPlan.integrationValidation !== 'accepted' &&
      env.executionPlan.integrationValidation !== 'not-applicable'
    ) {
      yield {
        kind: 'status',
        status: `Integration binding: ${env.executionPlan.integrationValidation.replace(
          /-/g,
          ' '
        )}.`,
        level: 'warning',
      };
    }

    if (
      (env.executionPlan.mode === 'patch' ||
        env.executionPlan.mode === 'state') &&
      env.executionPlan.validation !== 'accepted'
    ) {
      yield {
        kind: 'status',
        status:
          'Planner targets were incomplete, so Continuum is attempting the localized update using the full current view context.',
        level: 'warning',
      };
    }

    env.selectedTargets = [
      ...env.executionPlan.targetNodeIds,
      ...env.executionPlan.targetSemanticKeys,
    ];

    const stateOutcome = yield* runStatePhase(env);
    if (stateOutcome) {
      return stateOutcome;
    }

    const nextPromptMode =
      env.executionPlan.mode === 'view' &&
      (env.executionPlan.authoringMode === 'create-view' ||
        env.executionPlan.authoringMode === 'evolve-view')
        ? env.executionPlan.authoringMode
        : env.promptMode;

    const patchOutcome = yield* runPatchPhase(env);
    if (patchOutcome) {
      return patchOutcome;
    }

    const transformOutcome = yield* runTransformPhase(env);
    if (transformOutcome) {
      return transformOutcome;
    }

    return yield* runViewPhase(env, nextPromptMode);
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
