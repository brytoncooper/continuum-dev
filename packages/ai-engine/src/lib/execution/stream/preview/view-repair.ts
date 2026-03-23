import {
  type PromptMode,
  VIEW_DEFINITION_OUTPUT_CONTRACT,
} from '@continuum-dev/prompts';
import type { ViewDefinition } from '@continuum-dev/core';
import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
} from '../../../view-authoring/index.js';
import { buildRuntimeErrors } from '../../../view-generation/normalize/normalize.js';
import type {
  ContinuumChatAttachment,
  ContinuumExecutionAdapter,
  ContinuumExecutionContext,
  ContinuumExecutionRequest,
  ContinuumExecutionTraceEntry,
  StreamContinuumExecutionArgs,
} from '../../types.js';
import { mergeRequestAttachments, runGenerate } from '../trace/trace.js';
import { finalizeGeneratedView } from './view-finalize.js';

export async function repairGeneratedView(args: {
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

  const authoringFormat = args.authoringFormat ?? 'line-dsl';
  const structuredViewJson = authoringFormat === 'view-json';

  const repairRequest: ContinuumExecutionRequest = mergeRequestAttachments(
    {
      systemPrompt: buildViewAuthoringSystemPrompt({
        format: authoringFormat,
        mode: 'correction-loop',
        addons: args.addons,
      }),
      userMessage: buildViewAuthoringUserMessage({
        format: authoringFormat,
        mode: 'correction-loop',
        instruction: args.instruction,
        currentView: args.currentView,
        detachedFields: args.detachedFields,
        validationErrors: args.validationErrors,
        runtimeErrors: buildRuntimeErrors(args.issues ?? []),
        integrationBinding: args.integrationBinding,
      }),
      mode: 'repair',
      outputKind: structuredViewJson ? 'json-object' : 'text',
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
    format: authoringFormat,
    text: repairResponse.text,
    json: structuredViewJson ? repairResponse.json ?? undefined : undefined,
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
