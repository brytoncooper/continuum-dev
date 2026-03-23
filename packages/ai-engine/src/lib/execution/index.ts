import type { SessionStreamPart, ViewDefinition } from '@continuum-dev/core';
import {
  type PromptMode,
  VIEW_DEFINITION_OUTPUT_CONTRACT,
} from '@continuum-dev/prompts';
import {
  buildContinuumExecutionPlannerSystemPrompt,
  buildContinuumExecutionPlannerUserPrompt,
  buildIntegrationBindingParagraph,
  buildRegisteredActionsParagraph,
  getAvailableContinuumExecutionModes,
  resolveContinuumExecutionPlan,
} from '../continuum-execution/index.mjs';
import {
  buildContinuumPatchTargetCatalog,
  buildContinuumStateTargetCatalog,
  evaluateStateResponseQuality,
  parseContinuumStateResponse,
  type ContinuumExecutionTarget,
} from '../execution-targets/index.js';
import type { ContinuumSessionAdapter } from '../session/index.js';
import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
} from '../view-authoring/index.js';
import {
  normalizeViewDefinition,
  parseJson,
} from '../view-guardrails/index.js';
import {
  buildSurgicalTransformSystemPrompt,
  buildSurgicalTransformUserMessage,
  normalizeSurgicalTransformPlan,
} from '../view-transforms/index.js';
import {
  applyPatchPlanToView,
  buildDetachedFieldHints,
  buildPatchContext,
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  normalizeViewPatchPlan,
  VIEW_PATCH_OUTPUT_CONTRACT,
} from '../view-patching/index.js';
import {
  applyPatchPlanThroughUpdateParts,
  applyStateUpdatesThroughStreamingFoundation,
  applyThroughStreamingFoundation,
} from '../view-generation/apply.js';
import {
  buildRuntimeErrors,
  collectCandidateViewErrors,
  normalizeGeneratedView,
} from '../view-generation/normalize.js';
import type {
  ContinuumChatAttachment,
  ContinuumExecutionAdapter,
  ContinuumExecutionContext,
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
  ContinuumExecutionTraceEntry,
  StreamContinuumExecutionArgs,
} from './types.js';

const DEFAULT_VIEW_PREVIEW_THROTTLE_MS = 600;

export type {
  ContinuumExecutionAdapter,
  ContinuumExecutionContext,
  ContinuumExecutionEvent,
  ContinuumExecutionFinalResult,
  ContinuumChatAttachment,
  ContinuumIntegrationCatalog,
  ContinuumIntegrationEndpoint,
  ContinuumIntegrationPersistedField,
  ContinuumRegisteredActions,
  ContinuumExecutionOutputKind,
  ContinuumExecutionPhase,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
  ContinuumExecutionStatusLevel,
  ContinuumExecutionTraceEntry,
  StreamContinuumExecutionArgs,
} from './types.js';

interface SelectedExecutionPlan {
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

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function looksLikeStructuralEditInstruction(instruction: string): boolean {
  const t = instruction.trim().toLowerCase();
  return /\b(add|remove|move|delete|more|fewer|less|short|shorter|reorder|layout|row|column|section|field|label|insert|wrap)\b/.test(
    t
  );
}

function inferPromptMode(
  requestedMode: PromptMode | undefined,
  currentView: ViewDefinition | undefined
): PromptMode {
  if (requestedMode) {
    return requestedMode;
  }

  return currentView?.nodes.length ? 'evolve-view' : 'create-view';
}

function buildStateSystemPrompt(): string {
  return [
    'You help a user working in a web browser on a live Continuum form session.',
    'The state target catalog and current values describe fields the user can edit right now on the form they are looking at.',
    'Interpret their natural-language request in that product context.',
    'Your job is to help them manipulate values on the current form, not redesign structure or reason about internal data modeling abstractions.',
    'Your response is applied directly as session data updates to the current UI.',
    'Return exactly one JSON object and nothing else.',
    'Do not wrap the JSON in markdown fences.',
    'Return a state response, not a view or patch response.',
    'State response shape: {"updates":[...],"status":"optional short summary"}.',
    'Each update must target one of the provided selected targets by semanticKey, key, or nodeId.',
    'If no selected targets are provided, infer the smallest useful targets from the available state target catalog.',
    'Infer likely scope from the user request. For a request like "populate the email", updating one likely field is appropriate. For a request like "fill this out", multiple related fields can be appropriate.',
    'Only update existing stateful nodes that should actually change.',
    'Do not invent new node ids, semantic keys, or keys.',
    'Do not mutate view structure.',
    'When the user asks to populate, prefill, fill out, or use sample or demo values, supply plausible non-empty example values for the matched fields unless they gave explicit values in the instruction.',
    'When the instruction is vague, do your best using the current form context instead of refusing unnecessarily.',
    'Do not return empty-string values for populate or prefill requests when a meaningful example would help.',
    'If no existing target clearly matches the instruction, return {"updates":[],"status":"No safe state update found."} instead of guessing.',
    'For collections, target the collection node and provide {"value":{"items":[...]}}.',
    'Collection item objects should use template field semanticKey, key, or nodeId from the provided catalog.',
    'Prefer preserving meaningful user-entered values unless the instruction explicitly asks to overwrite them.',
  ].join('\n');
}

function buildStateUserMessage(args: {
  instruction: string;
  currentData: unknown;
  stateTargets: ContinuumExecutionTarget[];
  selectedTargets: string[];
  supplementalContext?: string;
  conversationSummary?: string;
}): string {
  const sections = [
    'Return the next Continuum state updates as JSON only.',
    'Continuum context:',
    '- The current form is already on screen in the browser.',
    '- The user wants this current form adjusted or populated.',
    '- The runtime will apply your response directly to the current session values.',
    '',
    'Selected targets:',
    args.selectedTargets.length > 0
      ? JSON.stringify(args.selectedTargets, null, 2)
      : 'none selected; infer the smallest matching targets from the available state targets below.',
    '',
    'Available state targets:',
    JSON.stringify(args.stateTargets, null, 2),
    '',
    'Current state values:',
    JSON.stringify(args.currentData ?? null, null, 2),
    '',
  ];
  if (
    typeof args.conversationSummary === 'string' &&
    args.conversationSummary.trim().length > 0
  ) {
    sections.push(
      'Recent conversation summary (bounded):',
      args.conversationSummary.trim(),
      ''
    );
  }
  sections.push('Instruction:', args.instruction.trim());
  if (args.supplementalContext && args.supplementalContext.trim().length > 0) {
    sections.push('', args.supplementalContext.trim());
  }
  return sections.join('\n');
}

function redactExecutionRequestForTrace(
  request: ContinuumExecutionRequest
): ContinuumExecutionRequest {
  const attachments = request.attachments;
  if (!attachments?.length) {
    return request;
  }
  return {
    ...request,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      base64: `[base64 ${attachment.base64.length} chars]`,
    })),
  };
}

function mergeRequestAttachments(
  request: ContinuumExecutionRequest,
  attachments: ContinuumChatAttachment[] | undefined
): ContinuumExecutionRequest {
  if (!attachments?.length) {
    return request;
  }
  return { ...request, attachments };
}

function toTraceEntry(
  phase: ContinuumExecutionRequest['mode'],
  request: ContinuumExecutionRequest,
  response: ContinuumExecutionResponse
): ContinuumExecutionTraceEntry {
  return {
    phase,
    request: redactExecutionRequestForTrace(request),
    response,
  };
}

async function runGenerate(
  adapter: ContinuumExecutionAdapter,
  request: ContinuumExecutionRequest,
  trace: ContinuumExecutionTraceEntry[]
): Promise<ContinuumExecutionResponse> {
  const response = await adapter.generate(request);
  trace.push(toTraceEntry(request.mode, request, response));
  return response;
}

function createNoopResult(args: {
  source: string;
  status: string;
  reason: string;
  requestedMode: 'state' | 'patch' | 'transform' | 'view';
  trace: ContinuumExecutionTraceEntry[];
}): ContinuumExecutionFinalResult {
  return {
    mode: 'noop',
    source: args.source,
    status: args.status,
    level: 'warning',
    trace: args.trace,
    requestedMode: args.requestedMode,
    reason: args.reason,
  };
}

function normalizePreviewView(
  currentView: ViewDefinition | undefined,
  candidateView: ViewDefinition
): ViewDefinition | null {
  try {
    if (currentView) {
      return normalizeGeneratedView(currentView, candidateView);
    }

    return normalizeViewDefinition(candidateView);
  } catch {
    return null;
  }
}

function shouldAttemptPreview(
  nextView: ViewDefinition,
  lastPreviewSignature: string | null
): boolean {
  const signature = JSON.stringify(nextView);
  return signature !== lastPreviewSignature;
}

const PREVIEW_VIEW_OR_NODE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_\-]*$/;
const PREVIEW_SEMANTIC_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
const PREVIEW_INTENT_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;

function isPlausibleViewIdForPreview(id: string): boolean {
  return PREVIEW_VIEW_OR_NODE_ID_PATTERN.test(id);
}

function isPlausibleNodeIdForPreview(id: string): boolean {
  return PREVIEW_VIEW_OR_NODE_ID_PATTERN.test(id);
}

function isPlausibleSemanticKeyForPreview(key: string | undefined): boolean {
  if (key === undefined || key.length === 0) {
    return true;
  }
  return PREVIEW_SEMANTIC_KEY_PATTERN.test(key);
}

function isPlausibleIntentIdForPreview(intentId: string | undefined): boolean {
  if (intentId === undefined || intentId.length === 0) {
    return true;
  }
  return PREVIEW_INTENT_ID_PATTERN.test(intentId);
}

function isPlausibleStreamingTextField(value: string | undefined): boolean {
  if (value === undefined || value.length === 0) {
    return true;
  }
  if (/^["'`]+$/.test(value)) {
    return false;
  }
  const first = value[0];
  if ((first === '"' || first === "'") && value.length > 1) {
    return false;
  }
  return true;
}

function viewNodePassesPreviewQualityGate(node: ViewDefinition['nodes'][number]): boolean {
  if (!isPlausibleNodeIdForPreview(node.id)) {
    return false;
  }

  const record = node as unknown as Record<string, unknown>;

  if (typeof record.key === 'string' && record.key.length > 0) {
    if (!PREVIEW_SEMANTIC_KEY_PATTERN.test(record.key)) {
      return false;
    }
  }

  if (typeof record.semanticKey === 'string') {
    if (!isPlausibleSemanticKeyForPreview(record.semanticKey)) {
      return false;
    }
  }

  if (typeof record.intentId === 'string') {
    if (!isPlausibleIntentIdForPreview(record.intentId)) {
      return false;
    }
  }

  if (typeof record.label === 'string') {
    if (!isPlausibleStreamingTextField(record.label)) {
      return false;
    }
  }

  if (typeof record.defaultValue === 'string') {
    if (!isPlausibleStreamingTextField(record.defaultValue)) {
      return false;
    }
  }

  if (typeof record.content === 'string') {
    if (!isPlausibleStreamingTextField(record.content)) {
      return false;
    }
  }

  const options = record.options;
  if (Array.isArray(options)) {
    for (const option of options) {
      if (!option || typeof option !== 'object') {
        return false;
      }
      const optionRecord = option as Record<string, unknown>;
      if (typeof optionRecord.value === 'string') {
        if (!isPlausibleStreamingTextField(optionRecord.value)) {
          return false;
        }
      }
      if (typeof optionRecord.label === 'string') {
        if (!isPlausibleStreamingTextField(optionRecord.label)) {
          return false;
        }
      }
    }
  }

  if ('children' in node && node.children) {
    for (const child of node.children) {
      if (!viewNodePassesPreviewQualityGate(child)) {
        return false;
      }
    }
  }
  if ('template' in node && node.template) {
    if (!viewNodePassesPreviewQualityGate(node.template)) {
      return false;
    }
  }
  return true;
}

function viewPassesPreviewQualityGate(view: ViewDefinition): boolean {
  if (!isPlausibleViewIdForPreview(view.viewId)) {
    return false;
  }
  for (const node of view.nodes) {
    if (!viewNodePassesPreviewQualityGate(node)) {
      return false;
    }
  }
  return true;
}

function finalizeGeneratedView(args: {
  currentView?: ViewDefinition;
  candidateView: ViewDefinition;
}): ViewDefinition {
  if (args.currentView) {
    return normalizeGeneratedView(args.currentView, args.candidateView);
  }

  return normalizeViewDefinition(args.candidateView);
}

async function repairGeneratedView(args: {
  adapter: ContinuumExecutionAdapter;
  trace: ContinuumExecutionTraceEntry[];
  authoringFormat: StreamContinuumExecutionArgs['authoringFormat'];
  instruction: string;
  mode: PromptMode;
  addons: StreamContinuumExecutionArgs['addons'];
  currentView?: ViewDefinition;
  detachedFields?: ContinuumExecutionContext['detachedFields'];
  issues?: ContinuumExecutionContext['issues'];
  validationErrors: string[];
  integrationBinding?: string;
  attachments?: ContinuumChatAttachment[];
}): Promise<ViewDefinition | null> {
  if (!args.currentView) {
    return null;
  }

  const repairRequest: ContinuumExecutionRequest = mergeRequestAttachments(
    {
      systemPrompt: buildViewAuthoringSystemPrompt({
        format: args.authoringFormat ?? 'line-dsl',
        mode: 'correction-loop',
        addons: args.addons,
      }),
      userMessage: buildViewAuthoringUserMessage({
        format: args.authoringFormat ?? 'line-dsl',
        mode: 'correction-loop',
        instruction: args.instruction,
        currentView: args.currentView,
        detachedFields: args.detachedFields,
        validationErrors: args.validationErrors,
        runtimeErrors: buildRuntimeErrors(args.issues ?? []),
        integrationBinding: args.integrationBinding,
      }),
      mode: 'repair',
      outputKind: 'text',
      outputContract: VIEW_DEFINITION_OUTPUT_CONTRACT,
      temperature: 0,
    },
    args.attachments
  );

  const repairResponse = await runGenerate(
    args.adapter,
    repairRequest,
    args.trace
  );
  const repairedView = parseViewAuthoringToViewDefinition({
    format: args.authoringFormat ?? 'line-dsl',
    text: repairResponse.text,
    fallbackView: args.currentView,
  });
  if (!repairedView) {
    return null;
  }

  try {
    return finalizeGeneratedView({
      currentView: args.currentView,
      candidateView: repairedView,
    });
  } catch {
    return null;
  }
}

export function buildContinuumExecutionContext(
  session: ContinuumSessionAdapter
): ContinuumExecutionContext {
  const snapshot = session.getSnapshot();

  return {
    currentView: snapshot?.view,
    currentData: snapshot?.data.values,
    detachedFields: buildDetachedFieldHints(session.getDetachedValues()),
    issues: session.getIssues(),
  };
}

export async function* streamContinuumExecution(
  args: StreamContinuumExecutionArgs
): AsyncGenerator<ContinuumExecutionEvent, ContinuumExecutionFinalResult> {
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

  try {
    const stateTargets = currentView
      ? buildContinuumStateTargetCatalog(currentView)
      : [];
    const patchTargets = currentView
      ? buildContinuumPatchTargetCatalog(currentView)
      : [];
    const patchContext = currentView
      ? buildPatchContext(currentView)
      : { nodeHints: [], compactTree: [] };
    const availableExecutionModes = getAvailableContinuumExecutionModes({
      hasCurrentView: Boolean(currentView?.nodes.length),
      hasStateTargets: stateTargets.length > 0,
    });

    let executionPlan: SelectedExecutionPlan = {
      mode: availableExecutionModes[0] ?? 'view',
      fallback: 'view',
      authoringMode:
        promptMode === 'create-view' || promptMode === 'evolve-view'
          ? promptMode
          : undefined,
      reason: autoApplyView
        ? 'planner pending'
        : 'view generation requested',
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: 'accepted',
      integrationValidation: 'not-applicable',
    };

    if (autoApplyView) {
      yield {
        kind: 'status',
        status: 'Planning the best Continuum execution path for this request.',
        level: 'info',
      };

      const plannerRequest: ContinuumExecutionRequest = attach({
        systemPrompt: buildContinuumExecutionPlannerSystemPrompt({
          hasRestoreContinuity,
          integrationCatalog,
          registeredActions,
        }),
        userMessage: buildContinuumExecutionPlannerUserPrompt({
          availableModes: availableExecutionModes,
          patchTargets,
          stateTargets,
          compactTree: patchContext.compactTree,
          currentData,
          instruction: args.instruction,
          conversationSummary: conversationSummary || undefined,
          detachedFields,
          integrationCatalog,
          registeredActions,
        }),
        mode: 'planner',
        outputKind: 'json-object',
        temperature: 0,
        maxTokens: 512,
      });
      const plannerResponse = await runGenerate(
        args.adapter,
        plannerRequest,
        trace
      );

      executionPlan = resolveContinuumExecutionPlan({
        text: plannerResponse.text,
        availableModes: availableExecutionModes,
        patchTargets,
        stateTargets,
        integrationCatalog,
      });
    }

    const endpointSchemaBinding = buildIntegrationBindingParagraph({
      integrationCatalog,
      endpointId: executionPlan.endpointId,
      payloadSemanticKeys: executionPlan.payloadSemanticKeys,
    });
    const actionsBinding = buildRegisteredActionsParagraph({ registeredActions });
    const integrationBinding = [endpointSchemaBinding, actionsBinding]
      .filter((section) => typeof section === 'string' && section.trim().length > 0)
      .join('\n\n');

    yield {
      kind: 'status',
      status: `Planner chose ${executionPlan.mode} mode${
        executionPlan.reason ? `: ${executionPlan.reason}.` : '.'
      }${
        executionPlan.endpointId
          ? ` Integration endpoint: ${executionPlan.endpointId}.`
          : ''
      }`,
      level: 'info',
    };

    if (
      integrationCatalog &&
      executionPlan.integrationValidation &&
      executionPlan.integrationValidation !== 'accepted' &&
      executionPlan.integrationValidation !== 'not-applicable'
    ) {
      yield {
        kind: 'status',
        status: `Integration binding: ${executionPlan.integrationValidation.replace(
          /-/g,
          ' '
        )}.`,
        level: 'warning',
      };
    }

    if (
      (executionPlan.mode === 'patch' || executionPlan.mode === 'state') &&
      executionPlan.validation !== 'accepted'
    ) {
      yield {
        kind: 'status',
        status:
          'Planner targets were incomplete, so Continuum is attempting the localized update using the full current view context.',
        level: 'warning',
      };
    }

    const selectedTargets = [
      ...executionPlan.targetNodeIds,
      ...executionPlan.targetSemanticKeys,
    ];

    if (executionPlan.mode === 'state' && currentView) {
      const stateRetryFeedback =
        'The previous JSON was rejected by validation: populate, prefill, fill, sample, or demo requests must include plausible non-empty values for the targeted fields, or return {"updates":[],"status":"No safe state update found."} if no safe update is possible.';

      const stateIntegrationContext = integrationBinding.trim()
        ? integrationBinding
        : undefined;

      const stateRequestBase = attach({
        systemPrompt: buildStateSystemPrompt(),
        userMessage: buildStateUserMessage({
          instruction: args.instruction,
          currentData,
          stateTargets,
          selectedTargets,
          conversationSummary: conversationSummary || undefined,
          supplementalContext: stateIntegrationContext,
        }),
        mode: 'state' as const,
        outputKind: 'json-object' as const,
        temperature: 0,
      });
      let stateResponse = await runGenerate(
        args.adapter,
        stateRequestBase,
        trace
      );
      let parsedState = parseContinuumStateResponse({
        text: stateResponse.text,
        targetCatalog: stateTargets,
      });
      let stateQuality = parsedState
        ? evaluateStateResponseQuality(
            parsedState,
            args.instruction,
            stateTargets
          )
        : 'invalid';

      if (stateQuality === 'weak_noop') {
        yield {
          kind: 'status',
          status:
            'State response looked empty for a populate-style request; retrying with validation feedback.',
          level: 'info',
        };
        const retryRequest: ContinuumExecutionRequest = attach({
          ...stateRequestBase,
          userMessage: buildStateUserMessage({
            instruction: args.instruction,
            currentData,
            stateTargets,
            selectedTargets,
            conversationSummary: conversationSummary || undefined,
            supplementalContext: [stateIntegrationContext, stateRetryFeedback]
              .filter((value) => typeof value === 'string' && value.trim().length > 0)
              .join('\n\n'),
          }),
        });
        stateResponse = await runGenerate(args.adapter, retryRequest, trace);
        parsedState = parseContinuumStateResponse({
          text: stateResponse.text,
          targetCatalog: stateTargets,
        });
        stateQuality = parsedState
          ? evaluateStateResponseQuality(
              parsedState,
              args.instruction,
              stateTargets
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
          source: args.adapter.label,
          status:
            parsedState.status ??
            `Applied ${parsedState.updates.length} Continuum state update${
              parsedState.updates.length === 1 ? '' : 's'
            } from ${args.adapter.label}.`,
          level: 'success',
          trace,
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
    }

    const nextPromptMode =
      executionPlan.mode === 'view' &&
      (executionPlan.authoringMode === 'create-view' ||
        executionPlan.authoringMode === 'evolve-view')
        ? executionPlan.authoringMode
        : promptMode;

    if (executionPlan.mode === 'patch' && currentView) {
      const patchRetryFeedback =
        'The previous JSON did not yield usable patch operations. Return mode="patch" with a non-empty operations array using only supported kinds, valid existing node ids from the index, or mode="full" with fullStrategy if a full view change is required.';

      const patchMessageSections = [
        buildPatchUserMessage({
          viewId: currentView.viewId,
          version: currentView.version,
          instruction: args.instruction,
          nodeHints: patchContext.nodeHints,
          compactTree: patchContext.compactTree,
          detachedFields,
          conversationSummary: conversationSummary || undefined,
        }),
        'Planner-selected localized targets:',
        JSON.stringify(selectedTargets, null, 2),
      ];
      if (integrationBinding.trim().length > 0) {
        patchMessageSections.push(integrationBinding);
      }

      const patchUserMessageBase = patchMessageSections.join('\n\n');

      const patchRequest: ContinuumExecutionRequest = attach({
        systemPrompt: buildPatchSystemPrompt(),
        userMessage: patchUserMessageBase,
        mode: 'patch',
        outputKind: 'json-object',
        outputContract: VIEW_PATCH_OUTPUT_CONTRACT,
        temperature: 0,
      });
      let patchResponse = await runGenerate(
        args.adapter,
        patchRequest,
        trace
      );
      let rawPatchValue =
        patchResponse.json ?? parseJson<unknown>(patchResponse.text);
      let normalizedPatch = normalizeViewPatchPlan(rawPatchValue);
      let parsedPatch = normalizedPatch.plan;

      if (!parsedPatch) {
        const firstOp = Array.isArray((rawPatchValue as any)?.operations)
          ? (rawPatchValue as any).operations[0]
          : null;
        const opKeys =
          firstOp && typeof firstOp === 'object'
            ? JSON.stringify(firstOp).slice(0, 200)
            : 'no operations';
        yield {
          kind: 'status',
          status: `[debug] Patch normalization failed: ${normalizedPatch.reason ?? 'unknown reason'}. First op: ${opKeys}`,
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

      if (patchLooksEmpty && looksLikeStructuralEditInstruction(args.instruction)) {
        yield {
          kind: 'status',
          status:
            'Patch response had no operations; retrying once with validation feedback.',
          level: 'info',
        };
        const patchRetryRequest: ContinuumExecutionRequest = attach({
          ...patchRequest,
          userMessage: `${patchUserMessageBase}\n\n${patchRetryFeedback}`,
        });
        patchResponse = await runGenerate(
          args.adapter,
          patchRetryRequest,
          trace
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
          source: args.adapter.label,
          status: `Applied localized Continuum patch operations from ${args.adapter.label}.`,
          level: 'success',
          trace,
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
        source: args.adapter.label,
        status,
        reason,
        requestedMode: 'patch',
        trace,
      });
    }

    if (executionPlan.mode === 'transform' && currentView) {
      yield {
        kind: 'status',
        status: 'Generating surgical transform plan.',
        level: 'info',
      };

      const surgicalRequest: ContinuumExecutionRequest = attach({
        systemPrompt: buildSurgicalTransformSystemPrompt(),
        userMessage: [
          buildSurgicalTransformUserMessage({
            instruction: args.instruction,
            currentView,
            currentData,
            selectedTargets,
            conversationSummary: conversationSummary || undefined,
          }),
          integrationBinding.trim().length > 0 ? integrationBinding : '',
        ]
          .filter((section) => typeof section === 'string' && section.trim().length > 0)
          .join('\n\n'),
        mode: 'transform',
        outputKind: 'json-object',
        temperature: 0,
      });
      const surgicalResponse = await runGenerate(
        args.adapter,
        surgicalRequest,
        trace
      );
      const normalizedSurgical = normalizeSurgicalTransformPlan(
        surgicalResponse.json ?? parseJson<unknown>(surgicalResponse.text),
        currentView
      );

      if (normalizedSurgical.plan) {
        const { patchOperations, continuityOperations } =
          normalizedSurgical.plan;

        // Apply patch operations to get the next view
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
            source: args.adapter.label,
            status: surgicalPatchStatus,
            reason:
              normalizedSurgical.reason ??
              'Surgical transform patch operations were invalid.',
            requestedMode: 'transform',
            trace,
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
          source: args.adapter.label,
          status: `Applied surgical Continuum transform from ${args.adapter.label}.`,
          level: 'success' as const,
          trace,
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
        source: args.adapter.label,
        status: surgicalStatus,
        reason:
          normalizedSurgical.reason ??
          'Surgical transform did not yield a usable plan.',
        requestedMode: 'transform',
        trace,
      });
    }

    const fullViewRequest: ContinuumExecutionRequest = attach({
      systemPrompt: buildViewAuthoringSystemPrompt({
        format: authoringFormat,
        mode: nextPromptMode,
        addons: args.addons,
      }),
      userMessage: buildViewAuthoringUserMessage({
        format: authoringFormat,
        mode: nextPromptMode,
        instruction: args.instruction,
        currentView:
          nextPromptMode === 'create-view' ? undefined : currentView,
        detachedFields:
          nextPromptMode === 'create-view' ? undefined : detachedFields,
        conversationSummary: conversationSummary || undefined,
        runtimeErrors:
          nextPromptMode === 'correction-loop'
            ? buildRuntimeErrors(issues)
            : undefined,
        integrationBinding:
          integrationBinding.trim().length > 0 ? integrationBinding : undefined,
      }),
      mode: 'view',
      outputKind: 'text',
      outputContract: VIEW_DEFINITION_OUTPUT_CONTRACT,
    });

    let finalViewText = '';
    let lastPreviewSignature: string | null = null;

    if (typeof args.adapter.streamText === 'function') {
      const textStream = args.adapter.streamText(fullViewRequest);
      const emitPreviews = args.emitViewPreviews !== false;
      const throttleMs =
        args.viewPreviewThrottleMs !== undefined
          ? args.viewPreviewThrottleMs
          : DEFAULT_VIEW_PREVIEW_THROTTLE_MS;

      if (!emitPreviews) {
        for await (const chunk of textStream) {
          finalViewText += chunk;
        }
      } else if (throttleMs <= 0) {
        for await (const chunk of textStream) {
          finalViewText += chunk;
          const previewCandidate = parseViewAuthoringToViewDefinition({
            format: authoringFormat,
            text: finalViewText,
            fallbackView: currentView,
          });
          if (!previewCandidate) {
            continue;
          }

          const previewView = normalizePreviewView(currentView, previewCandidate);
          if (!previewView || !shouldAttemptPreview(previewView, lastPreviewSignature)) {
            continue;
          }

          lastPreviewSignature = JSON.stringify(previewView);
          yield {
            kind: 'view-preview',
            view: previewView,
          };
        }
      } else {
        let lastPreviewEmitAt: number | null = null;
        let pendingPreviewView: ViewDefinition | null = null;

        for await (const chunk of textStream) {
          finalViewText += chunk;
          const previewCandidate = parseViewAuthoringToViewDefinition({
            format: authoringFormat,
            text: finalViewText,
            fallbackView: currentView,
          });
          if (!previewCandidate) {
            continue;
          }

          const previewView = normalizePreviewView(currentView, previewCandidate);
          if (
            !previewView ||
            !viewPassesPreviewQualityGate(previewView) ||
            !shouldAttemptPreview(previewView, lastPreviewSignature)
          ) {
            continue;
          }

          const signature = JSON.stringify(previewView);
          pendingPreviewView = previewView;
          const now = Date.now();
          const allowEmit =
            lastPreviewEmitAt === null ||
            now - lastPreviewEmitAt >= throttleMs;
          if (allowEmit) {
            lastPreviewSignature = signature;
            lastPreviewEmitAt = now;
            yield {
              kind: 'view-preview',
              view: previewView,
            };
            pendingPreviewView = null;
          }
        }

        if (pendingPreviewView !== null) {
          const pendingSig = JSON.stringify(pendingPreviewView);
          if (pendingSig !== lastPreviewSignature) {
            yield {
              kind: 'view-preview',
              view: pendingPreviewView,
            };
          }
        }
      }

      const streamedViewResponse: ContinuumExecutionResponse = {
        text: finalViewText,
        raw: finalViewText,
      };
      trace.push(
        toTraceEntry('view', fullViewRequest, streamedViewResponse)
      );
    } else {
      finalViewText = (
        await runGenerate(args.adapter, fullViewRequest, trace)
      ).text;
    }

    const parsedView = parseViewAuthoringToViewDefinition({
      format: authoringFormat,
      text: finalViewText,
      fallbackView: currentView,
    });

    let finalView: ViewDefinition | null = null;
    let validationErrors: string[] = [];

    if (parsedView) {
      try {
        finalView = finalizeGeneratedView({
          currentView,
          candidateView: parsedView,
        });
      } catch (error) {
        validationErrors = [normalizeError(error).message];
      }
    } else {
      validationErrors = ['Model output did not compile into a valid ViewDefinition.'];
    }

    if (!finalView && currentView) {
      if (validationErrors.length === 0 && parsedView) {
        validationErrors = collectCandidateViewErrors(currentView, parsedView);
      }

      yield {
        kind: 'status',
        status:
          'The generated view was invalid, so Continuum is repairing it before apply.',
        level: 'warning',
      };

      finalView = await repairGeneratedView({
        adapter: args.adapter,
        trace,
        authoringFormat,
        instruction: args.instruction,
        mode: nextPromptMode,
        addons: args.addons,
        currentView,
        detachedFields,
        issues,
        validationErrors,
        integrationBinding:
          integrationBinding.trim().length > 0 ? integrationBinding : undefined,
        attachments: chatAttachments,
      });
    }

    if (!finalView) {
      throw new Error(
        validationErrors[0] ??
          'The model response did not produce a valid Continuum view.'
      );
    }


    yield {
      kind: 'view-final',
      view: finalView,
    };

    return {
      mode: 'view',
      source: args.adapter.label,
      status: `Generated a Continuum view from ${args.adapter.label}.`,
      level: 'success',
      trace,
      view: finalView,
      parsed: finalView,
    };
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

export async function runContinuumExecution(
  args: StreamContinuumExecutionArgs
): Promise<ContinuumExecutionFinalResult> {
  const iterator = streamContinuumExecution(args);
  let next = await iterator.next();

  while (!next.done) {
    next = await iterator.next();
  }

  return next.value;
}

export function applyContinuumExecutionFinalResult(
  session: ContinuumSessionAdapter,
  result: ContinuumExecutionFinalResult
): void {
  if (result.mode === 'state') {
    if (
      applyStateUpdatesThroughStreamingFoundation(
        session,
        result.source,
        result.currentView,
        result.updates
      )
    ) {
      return;
    }

    for (const update of result.updates) {
      session.proposeValue(update.nodeId, update.value, result.source);
    }
    return;
  }

  if (result.mode === 'patch') {
    if (
      applyPatchPlanThroughUpdateParts(
        session,
        result.source,
        result.currentView,
        result.patchPlan
      )
    ) {
      return;
    }

    const nextView = applyPatchPlanToView(result.currentView, result.patchPlan);
    if (!nextView) {
      throw new Error('Unable to apply the generated Continuum patch plan.');
    }

    session.applyView(nextView);
    return;
  }

  if (result.mode === 'noop') {
    return;
  }

  const viewPart: SessionStreamPart = {
    kind: 'view',
    view: result.view,
    ...(result.mode === 'transform'
      ? { transformPlan: result.transformPlan }
      : {}),
  };

  if (
    applyThroughStreamingFoundation(
      session,
      result.source,
      result.view.viewId,
      [viewPart],
      'draft'
    )
  ) {
    return;
  }

  session.applyView(
    result.view,
    result.mode === 'transform'
      ? { transformPlan: result.transformPlan }
      : undefined
  );
}
