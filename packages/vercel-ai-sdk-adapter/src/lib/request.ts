import type { NodeValue, ViewDefinition } from '@continuum-dev/core';
import type {
  ContinuumExecutionMode,
  ContinuumExecutionPlan,
  ContinuumIntegrationCatalog,
  ContinuumRegisteredActions,
  ContinuumViewAuthoringFormat,
} from '@continuum-dev/ai-engine';
import type {
  DetachedFieldHint,
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';

export interface ContinuumVercelAiSdkRequestOptions {
  instruction?: string;
  mode?: PromptMode;
  executionMode?: ContinuumExecutionMode;
  executionPlan?: ContinuumExecutionPlan;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: ContinuumViewAuthoringFormat;
  autoApplyView?: boolean;
  emitViewPreviews?: boolean;
  viewPreviewThrottleMs?: number;
  /**
   * When true, a demo host may stream a plain assistant reply that describes
   * multimodal input (text and files) instead of running Continuum execution.
   * Requires `messages` on the POST body.
   */
  debugEcho?: boolean;
}

export interface ContinuumVercelAiSdkRequestBody {
  currentView?: ViewDefinition | null;
  currentData?: Record<string, NodeValue | undefined> | null;
  conversationSummary?: string | null;
  detachedValues?: Record<string, unknown> | null;
  detachedFields?: DetachedFieldHint[] | null;
  /**
   * Optional simulated product backend catalog (for example demo app endpoints
   * and persisted fields). Forwarded into `ContinuumExecutionContext`.
   */
  integrationCatalog?: ContinuumIntegrationCatalog | null;
  /**
   * Optional snapshot of `Session.getRegisteredActions()` for prompts (intent
   * ids → labels). Forwarded into `ContinuumExecutionContext`.
   */
  registeredActions?: ContinuumRegisteredActions | null;
  continuum?: ContinuumVercelAiSdkRequestOptions;
}

export interface BuildContinuumVercelAiSdkRequestBodyOptions<
  BODY extends Record<string, unknown> = Record<string, unknown>
> {
  body?: BODY | null;
  currentView?: ViewDefinition | null;
  currentData?: Record<string, NodeValue | undefined> | null;
  conversationSummary?: string | null;
  detachedValues?: Record<string, unknown> | null;
  detachedFields?: DetachedFieldHint[] | null;
  integrationCatalog?: ContinuumIntegrationCatalog | null;
  registeredActions?: ContinuumRegisteredActions | null;
  continuum?: ContinuumVercelAiSdkRequestOptions;
}

export function buildContinuumVercelAiSdkRequestBody<
  BODY extends Record<string, unknown> = Record<string, unknown>
>(
  options: BuildContinuumVercelAiSdkRequestBodyOptions<BODY> = {}
): BODY & ContinuumVercelAiSdkRequestBody {
  const result = {
    ...(options.body ?? ({} as BODY)),
  } as BODY & ContinuumVercelAiSdkRequestBody;

  if ('currentView' in options) {
    result.currentView = options.currentView ?? null;
  }

  if ('currentData' in options) {
    result.currentData = options.currentData ?? null;
  }

  if ('conversationSummary' in options) {
    result.conversationSummary = options.conversationSummary ?? null;
  }

  if ('detachedValues' in options) {
    result.detachedValues = options.detachedValues ?? null;
  }

  if ('detachedFields' in options) {
    result.detachedFields = options.detachedFields ?? null;
  }

  if ('integrationCatalog' in options) {
    result.integrationCatalog = options.integrationCatalog ?? null;
  }

  if ('registeredActions' in options) {
    result.registeredActions = options.registeredActions ?? null;
  }

  if (options.continuum) {
    result.continuum = options.continuum;
  }

  return result;
}
