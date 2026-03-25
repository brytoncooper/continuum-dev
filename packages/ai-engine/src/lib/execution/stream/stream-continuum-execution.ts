import { resolveOssExecutionPlan } from '../resolve-oss-execution-plan.js';
import { normalizeError } from './trace/normalize-error.js';
import type {
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
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
    env.executionPlan = resolveOssExecutionPlan({
      executionPlan: env.args.executionPlan,
      executionMode: env.args.executionMode,
      authoringPromptMode: env.args.mode,
      availableExecutionModes: env.availableExecutionModes,
      stateTargets: env.stateTargets,
      patchTargets: env.patchTargets,
      currentView: env.currentView,
    });

    env.integrationBinding = '';

    yield {
      kind: 'status',
      status: `OSS execution chose ${env.executionPlan.mode} mode${
        env.executionPlan.reason ? `: ${env.executionPlan.reason}` : '.'
      }`,
      level: 'info',
    };

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
