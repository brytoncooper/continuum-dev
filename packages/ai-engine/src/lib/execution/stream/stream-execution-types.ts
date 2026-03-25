import type { ViewDefinition } from '@continuum-dev/core';
import type { PromptMode } from '@continuum-dev/prompts';
import type { ContinuumExecutionMode } from '../planner-types.js';
import { getAvailableContinuumExecutionModes } from '../reference-execution-modes.js';
import {
  buildContinuumPatchTargetCatalog,
  buildContinuumStateTargetCatalog,
  type ContinuumExecutionTarget,
} from '../../execution-targets/index.js';
import type { ContinuumViewAuthoringFormat } from '../../view-authoring/index.js';
import {
  buildPatchContext,
  type PatchContextPayload,
} from '../../view-patching/index.js';
import { inferPromptMode } from './instruction/instruction-heuristics.js';
import { mergeRequestAttachments } from './trace/trace.js';
import type { ScopedEditBrief } from '@continuum-dev/protocol';
import type {
  ContinuumExecutionContext,
  ContinuumExecutionRequest,
  ContinuumExecutionTraceEntry,
  StreamContinuumExecutionArgs,
} from '../types.js';

export interface SelectedExecutionPlan {
  mode: 'state' | 'patch' | 'transform' | 'view';
  fallback: string;
  authoringMode?: Extract<PromptMode, 'create-view' | 'evolve-view'>;
  reason?: string;
  targetNodeIds: string[];
  targetSemanticKeys: string[];
  validation: string;
  endpointId?: string;
  payloadSemanticKeys?: string[];
  integrationValidation?:
    | 'accepted'
    | 'missing-endpoint'
    | 'invalid-endpoint'
    | 'missing-payload-keys'
    | 'partial-payload-keys'
    | 'not-applicable';
}

export interface StreamContinuumExecutionEnv {
  args: StreamContinuumExecutionArgs;
  trace: ContinuumExecutionTraceEntry[];
  attach: (request: ContinuumExecutionRequest) => ContinuumExecutionRequest;
  currentView: ViewDefinition | undefined;
  currentData: unknown;
  detachedFields: NonNullable<ContinuumExecutionContext['detachedFields']>;
  conversationSummary: string;
  hasRestoreContinuity: boolean;
  issues: NonNullable<ContinuumExecutionContext['issues']>;
  integrationCatalog: ContinuumExecutionContext['integrationCatalog'];
  registeredActions: ContinuumExecutionContext['registeredActions'];
  chatAttachments: ContinuumExecutionContext['chatAttachments'];
  authoringFormat: ContinuumViewAuthoringFormat;
  promptMode: PromptMode;
  autoApplyView: boolean;
  stateTargets: ContinuumExecutionTarget[];
  patchTargets: ReturnType<typeof buildContinuumPatchTargetCatalog>;
  patchContext: PatchContextPayload;
  availableExecutionModes: ContinuumExecutionMode[];
  executionPlan: SelectedExecutionPlan;
  integrationBinding: string;
  selectedTargets: string[];
  scopedEditBrief?: ScopedEditBrief;
}

export function createStreamContinuumExecutionEnv(
  args: StreamContinuumExecutionArgs
): StreamContinuumExecutionEnv {
  const trace: ContinuumExecutionTraceEntry[] = [];
  const currentView = args.context?.currentView;
  const currentData = args.context?.currentData ?? {};
  const detachedFields = args.context?.detachedFields ?? [];
  const conversationSummary = args.context?.conversationSummary?.trim() ?? '';
  const hasRestoreContinuity =
    conversationSummary.length > 0 || detachedFields.length > 0;
  const issues = args.context?.issues ?? [];
  const integrationCatalog = args.context?.integrationCatalog;
  const registeredActions = args.context?.registeredActions;
  const chatAttachments = args.context?.chatAttachments;
  const attach = (request: ContinuumExecutionRequest): ContinuumExecutionRequest =>
    mergeRequestAttachments(request, chatAttachments);
  const authoringFormat = args.authoringFormat ?? 'line-dsl';
  const promptMode = inferPromptMode(args.mode, currentView);
  const autoApplyView = args.autoApplyView ?? true;

  const stateTargets = currentView
    ? buildContinuumStateTargetCatalog(currentView)
    : [];
  const patchTargets = currentView
    ? buildContinuumPatchTargetCatalog(currentView)
    : [];
  const patchContext: PatchContextPayload = currentView
    ? buildPatchContext(currentView)
    : { nodeHints: [], compactTree: [] };
  const availableExecutionModes = getAvailableContinuumExecutionModes({
    hasCurrentView: Boolean(currentView?.nodes.length),
    hasStateTargets: stateTargets.length > 0,
  });

  const executionPlan: SelectedExecutionPlan = {
    mode: 'view',
    fallback: 'view',
    authoringMode:
      promptMode === 'create-view' || promptMode === 'evolve-view'
        ? promptMode
        : undefined,
    reason: 'OSS default: full view generation (resolved in stream).',
    targetNodeIds: [],
    targetSemanticKeys: [],
    validation: 'accepted',
    integrationValidation: 'not-applicable',
  };

  return {
    args,
    trace,
    attach,
    currentView,
    currentData,
    detachedFields,
    conversationSummary,
    hasRestoreContinuity,
    issues,
    integrationCatalog,
    registeredActions,
    chatAttachments,
    authoringFormat,
    promptMode,
    autoApplyView,
    stateTargets,
    patchTargets,
    patchContext,
    availableExecutionModes,
    executionPlan,
    integrationBinding: '',
    selectedTargets: [],
    scopedEditBrief: args.scopedEditBrief,
  };
}
