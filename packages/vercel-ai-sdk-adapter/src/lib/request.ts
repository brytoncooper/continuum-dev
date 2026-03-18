import type { NodeValue, ViewDefinition } from '@continuum-dev/core';
import type { ContinuumViewAuthoringFormat } from '@continuum-dev/ai-engine';
import type {
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';

export interface ContinuumVercelAiSdkRequestOptions {
  instruction?: string;
  mode?: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: ContinuumViewAuthoringFormat;
  autoApplyView?: boolean;
}

export interface ContinuumVercelAiSdkRequestBody {
  currentView?: ViewDefinition | null;
  currentData?: Record<string, NodeValue | undefined> | null;
  continuum?: ContinuumVercelAiSdkRequestOptions;
}

export interface BuildContinuumVercelAiSdkRequestBodyOptions<
  BODY extends Record<string, unknown> = Record<string, unknown>,
> {
  body?: BODY | null;
  currentView?: ViewDefinition | null;
  currentData?: Record<string, NodeValue | undefined> | null;
  continuum?: ContinuumVercelAiSdkRequestOptions;
}

export function buildContinuumVercelAiSdkRequestBody<
  BODY extends Record<string, unknown> = Record<string, unknown>,
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

  if (options.continuum) {
    result.continuum = options.continuum;
  }

  return result;
}
