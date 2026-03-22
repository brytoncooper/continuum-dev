import type {
  ContinuumTransformPlan,
  NodeValue,
  ViewDefinition,
} from '@continuum-dev/core';
import type {
  DetachedFieldHint,
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import type { ContinuumStateUpdate } from '../execution-targets/index.js';
import type { ContinuumViewAuthoringFormat } from '../view-authoring/index.js';
import type { ViewPatchPlan } from '../view-patching/index.js';

export type ContinuumExecutionPhase =
  | 'planner'
  | 'state'
  | 'patch'
  | 'transform'
  | 'view'
  | 'repair';

export type ContinuumExecutionOutputKind = 'text' | 'json-object';

export type ContinuumExecutionStatusLevel =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface ContinuumExecutionRequest {
  systemPrompt: string;
  userMessage: string;
  mode: ContinuumExecutionPhase;
  outputKind?: ContinuumExecutionOutputKind;
  outputContract?: PromptOutputContract;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  providerOptions?: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

export interface ContinuumExecutionResponse {
  text: string;
  json?: unknown | null;
  raw?: unknown;
}

export interface ContinuumExecutionAdapter {
  label: string;
  generate(
    request: ContinuumExecutionRequest
  ): Promise<ContinuumExecutionResponse>;
  streamText?(request: ContinuumExecutionRequest): AsyncIterable<string>;
  streamObject?(request: ContinuumExecutionRequest): AsyncIterable<unknown>;
}

export interface ContinuumExecutionContext {
  currentView?: ViewDefinition;
  currentData?: Record<string, NodeValue | undefined>;
  detachedFields?: DetachedFieldHint[];
  /**
   * Bounded, caller-supplied text (for example recent user-visible turns) so
   * referential follow-ups can be interpreted against prior intent.
   */
  conversationSummary?: string;
  issues?: unknown[];
}

/**
 * Inputs for `streamContinuumExecution`. Initial view authoring may stream a
 * full text document; follow-up edits can later move toward smaller patch and
 * state events once that path is validated in product.
 */
export interface StreamContinuumExecutionArgs {
  adapter: ContinuumExecutionAdapter;
  instruction: string;
  context?: ContinuumExecutionContext;
  mode?: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: ContinuumViewAuthoringFormat;
  autoApplyView?: boolean;
}

export interface ContinuumExecutionTraceEntry {
  phase: ContinuumExecutionPhase;
  request: ContinuumExecutionRequest;
  response: ContinuumExecutionResponse;
}

interface ContinuumExecutionFinalResultBase {
  source: string;
  status: string;
  level: ContinuumExecutionStatusLevel;
  trace: ContinuumExecutionTraceEntry[];
}

export interface ContinuumStateExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'state';
  currentView: ViewDefinition;
  updates: ContinuumStateUpdate[];
  parsed: {
    updates: ContinuumStateUpdate[];
    status?: string;
  };
}

export interface ContinuumPatchExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'patch';
  currentView: ViewDefinition;
  patchPlan: ViewPatchPlan;
  parsed: ViewPatchPlan;
}

export interface ContinuumViewExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'view';
  view: ViewDefinition;
  parsed: ViewDefinition;
}

export interface ContinuumTransformExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'transform';
  view: ViewDefinition;
  transformPlan: ContinuumTransformPlan;
  parsed: {
    view: ViewDefinition;
    transformPlan: ContinuumTransformPlan;
  };
}

export interface ContinuumNoopExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'noop';
  requestedMode: 'state' | 'patch' | 'transform' | 'view';
  reason: string;
}

export type ContinuumExecutionFinalResult =
  | ContinuumStateExecutionFinalResult
  | ContinuumPatchExecutionFinalResult
  | ContinuumTransformExecutionFinalResult
  | ContinuumViewExecutionFinalResult
  | ContinuumNoopExecutionFinalResult;

export type ContinuumExecutionEvent =
  | {
      kind: 'status';
      status: string;
      level: ContinuumExecutionStatusLevel;
    }
  | {
      kind: 'state';
      currentView: ViewDefinition;
      update: ContinuumStateUpdate;
    }
  | {
      kind: 'patch';
      currentView: ViewDefinition;
      patchPlan: ViewPatchPlan;
    }
  | {
      kind: 'view-preview';
      view: ViewDefinition;
    }
  | {
      kind: 'view-final';
      view: ViewDefinition;
      transformPlan?: ContinuumTransformPlan;
    }
  | {
      kind: 'error';
      message: string;
      error: Error;
    };
