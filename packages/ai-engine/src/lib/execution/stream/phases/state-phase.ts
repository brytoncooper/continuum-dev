import {
  evaluateStateResponseQuality,
  parseContinuumStateResponse,
} from '../../../execution-targets/index.js';
import {
  buildStateSystemPrompt,
  buildStateUserMessage,
} from '../instruction/state-prompts.js';
import { runGenerate } from '../trace/trace.js';
import type {
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionRequest,
} from '../../types.js';
import type { StreamContinuumExecutionEnv } from '../stream-execution-types.js';

export async function* runStatePhase(
  env: StreamContinuumExecutionEnv
): AsyncGenerator<
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult | undefined
> {
  const { executionPlan, currentView } = env;
  if (executionPlan.mode !== 'state' || !currentView) {
    return undefined;
  }

  const stateRetryFeedback =
    'The previous JSON was rejected by validation: populate, prefill, fill, sample, or demo requests must include plausible non-empty values for the targeted fields, or return {"updates":[],"status":"No safe state update found."} if no safe update is possible.';

  const stateIntegrationContext = env.integrationBinding.trim()
    ? env.integrationBinding
    : undefined;

  const stateRequestBase = env.attach({
    systemPrompt: buildStateSystemPrompt(),
    userMessage: buildStateUserMessage({
      instruction: env.args.instruction,
      currentData: env.currentData,
      stateTargets: env.stateTargets,
      selectedTargets: env.selectedTargets,
      conversationSummary: env.conversationSummary || undefined,
      supplementalContext: stateIntegrationContext,
    }),
    mode: 'state' as const,
    outputKind: 'json-object' as const,
    temperature: 0,
  });
  let stateResponse = await runGenerate(
    env.args.adapter,
    stateRequestBase,
    env.trace
  );
  let parsedState = parseContinuumStateResponse({
    text: stateResponse.text,
    targetCatalog: env.stateTargets,
  });
  let stateQuality = parsedState
    ? evaluateStateResponseQuality(
        parsedState,
        env.args.instruction,
        env.stateTargets
      )
    : 'invalid';

  if (stateQuality === 'weak_noop') {
    yield {
      kind: 'status',
      status:
        'State response looked empty for a populate-style request; retrying with validation feedback.',
      level: 'info',
    };
    const retryRequest: ContinuumExecutionRequest = env.attach({
      ...stateRequestBase,
      userMessage: buildStateUserMessage({
        instruction: env.args.instruction,
        currentData: env.currentData,
        stateTargets: env.stateTargets,
        selectedTargets: env.selectedTargets,
        conversationSummary: env.conversationSummary || undefined,
        supplementalContext: [stateIntegrationContext, stateRetryFeedback]
          .filter(
            (value) => typeof value === 'string' && value.trim().length > 0
          )
          .join('\n\n'),
      }),
    });
    stateResponse = await runGenerate(env.args.adapter, retryRequest, env.trace);
    parsedState = parseContinuumStateResponse({
      text: stateResponse.text,
      targetCatalog: env.stateTargets,
    });
    stateQuality = parsedState
      ? evaluateStateResponseQuality(
          parsedState,
          env.args.instruction,
          env.stateTargets
        )
      : 'invalid';
  }

  if (
    parsedState &&
    parsedState.updates.length > 0 &&
    stateQuality !== 'weak_noop'
  ) {
    for (const update of parsedState.updates) {
      yield {
        kind: 'state',
        currentView,
        update,
      };
    }

    return {
      mode: 'state',
      source: env.args.adapter.label,
      status:
        parsedState.status ??
        `Applied ${parsedState.updates.length} Continuum state update${
          parsedState.updates.length === 1 ? '' : 's'
        } from ${env.args.adapter.label}.`,
      level: 'success',
      trace: env.trace,
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

  return undefined;
}
