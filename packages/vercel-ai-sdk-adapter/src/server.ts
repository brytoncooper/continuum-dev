import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  type FilePart,
  type InferUIMessageChunk,
  type LanguageModel,
  type ModelMessage,
  type TextPart,
  type UIMessage,
  type UIMessageStreamWriter,
} from 'ai';
import type { SessionStreamMode } from '@continuum-dev/core';
import type {
  ContinuumViewPatch,
  ContinuumViewPatchOperation,
  ContinuumViewPatchPosition,
} from '@continuum-dev/protocol';
import {
  buildDetachedFieldHints,
  parseJson,
  streamContinuumExecution as defaultStreamContinuumExecution,
  type ContinuumChatAttachment,
  type ContinuumExecutionAdapter,
  type ContinuumExecutionContext,
  type ContinuumExecutionEvent,
  type ContinuumExecutionFinalResult,
  type ContinuumExecutionRequest,
  type ContinuumExecutionResponse,
  type ContinuumExecutionTraceEntry,
  type ContinuumViewAuthoringFormat,
  type StreamContinuumExecutionArgs,
  type ViewPatchOperation,
} from '@continuum-dev/ai-engine';
import type {
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import type { ContinuumVercelAiSdkRequestBody } from './lib/request.js';
import type {
  ContinuumVercelAiSdkExecutionTraceData,
  ContinuumVercelAiSdkMessage,
} from './lib/types.js';
import { resolveTemperatureForLanguageModel } from './lib/resolve-temperature-for-language-model.js';

export interface VercelAiSdkContinuumExecutionAdapterOptions {
  label?: string;
  model?: LanguageModel;
  resolveModel?: (
    request: ContinuumExecutionRequest
  ) => Promise<LanguageModel> | LanguageModel;
  providerOptions?: Record<string, unknown>;
  resolveProviderOptions?: (
    request: ContinuumExecutionRequest
  ) =>
    | Promise<Record<string, unknown> | undefined>
    | Record<string, unknown>
    | undefined;
}

export interface WriteContinuumExecutionToUiMessageWriterArgs {
  writer: UIMessageStreamWriter<ContinuumVercelAiSdkMessage>;
  adapter: ContinuumExecutionAdapter;
  instruction: string;
  context?: ContinuumExecutionContext;
  mode?: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: ContinuumViewAuthoringFormat;
  autoApplyView?: boolean;
  emitViewPreviews?: boolean;
  viewPreviewThrottleMs?: number;
  viewStreamMode?: SessionStreamMode;
  streamContinuumExecution?: StreamContinuumExecutionFn;
}

export interface CreateContinuumUiMessageStreamArgs
  extends Omit<WriteContinuumExecutionToUiMessageWriterArgs, 'writer'> {
  writeFinalStatus?: boolean;
  writeErrorPart?: boolean;
  onResult?: (
    result: ContinuumExecutionFinalResult,
    writer: UIMessageStreamWriter<ContinuumVercelAiSdkMessage>
  ) => Promise<void> | void;
  onError?: (
    error: Error,
    writer: UIMessageStreamWriter<ContinuumVercelAiSdkMessage>
  ) => Promise<void> | void;
}

export interface CreateContinuumVercelAiSdkRouteHandlerOptions {
  adapter?: ContinuumExecutionAdapter;
  resolveAdapter?: (args: {
    request: Request;
    body: ContinuumVercelAiSdkRouteRequestBody;
  }) => Promise<ContinuumExecutionAdapter> | ContinuumExecutionAdapter;
  defaultMode?: PromptMode;
  defaultAuthoringFormat?: ContinuumViewAuthoringFormat;
  defaultViewStreamMode?: SessionStreamMode;
  streamContinuumExecution?: StreamContinuumExecutionFn;
}

export type ContinuumVercelAiSdkRouteRequestBody =
  ContinuumVercelAiSdkRequestBody & {
    messages?: Array<UIMessage | Record<string, unknown>>;
  } & Record<string, unknown>;

type ContinuumUiChunk = InferUIMessageChunk<ContinuumVercelAiSdkMessage>;
interface WriteExecutionEventResult {
  wroteMutation: boolean;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export type StreamContinuumExecutionFn = (
  args: StreamContinuumExecutionArgs
) => AsyncGenerator<ContinuumExecutionEvent, ContinuumExecutionFinalResult>;

const MAX_CONVERSATION_CONTEXT_CHARS = 12000;

const FALLBACK_INSTRUCTION_FOR_ATTACHMENTS =
  'Use the attached file(s) to inform your response.';

function parseDataUrlToBase64(
  url: string
): { mediaType: string; base64: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(url);
  if (!match) {
    return null;
  }
  return {
    mediaType: match[1].trim(),
    base64: match[2],
  };
}

/**
 * Collects user file parts from the **latest** user message in a Vercel AI SDK
 * chat `messages` array. Only `data:` URLs with a `;base64,` payload are
 * supported (matching typical browser `FileUIPart` serialization).
 *
 * @param messages - Same `messages` array as the chat POST body.
 * @returns Attachments in adapter-ready form, newest user message only.
 */
export function extractChatAttachmentsFromMessages(
  messages: ContinuumVercelAiSdkRouteRequestBody['messages']
): ContinuumChatAttachment[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object') {
      continue;
    }
    if ((message as { role?: unknown }).role !== 'user') {
      continue;
    }

    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) {
      return [];
    }

    const collected: ContinuumChatAttachment[] = [];
    for (const part of parts) {
      if (!part || typeof part !== 'object') {
        continue;
      }
      if ((part as { type?: unknown }).type !== 'file') {
        continue;
      }
      const url = (part as { url?: unknown }).url;
      if (typeof url !== 'string' || url.length === 0) {
        continue;
      }
      const parsed = parseDataUrlToBase64(url);
      if (!parsed) {
        continue;
      }
      const declaredType = (part as { mediaType?: unknown }).mediaType;
      const resolvedMediaType =
        typeof declaredType === 'string' && declaredType.trim().length > 0
          ? declaredType.trim()
          : parsed.mediaType;
      const filename = (part as { filename?: unknown }).filename;
      const namedFilename =
        typeof filename === 'string' && filename.trim().length > 0
          ? filename.trim()
          : undefined;
      const isImage = resolvedMediaType.startsWith('image/');
      collected.push(
        isImage
          ? {
              kind: 'image',
              mediaType: resolvedMediaType,
              base64: parsed.base64,
              ...(namedFilename ? { filename: namedFilename } : {}),
            }
          : {
              kind: 'file',
              mediaType: resolvedMediaType,
              base64: parsed.base64,
              ...(namedFilename ? { filename: namedFilename } : {}),
            }
      );
    }
    return collected;
  }

  return [];
}

type LanguageModelPromptArgs =
  | { kind: 'prompt'; system: string; prompt: string }
  | { kind: 'messages'; system: string; messages: ModelMessage[] };

function buildLanguageModelPromptArgs(
  request: ContinuumExecutionRequest
): LanguageModelPromptArgs {
  const attachments = request.attachments ?? [];
  if (attachments.length === 0) {
    return {
      kind: 'prompt',
      system: request.systemPrompt,
      prompt: request.userMessage,
    };
  }

  const userContent: Array<TextPart | FilePart> = [
    { type: 'text', text: request.userMessage },
  ];
  for (const attachment of attachments) {
    userContent.push({
      type: 'file',
      data: attachment.base64,
      mediaType: attachment.mediaType,
      ...(attachment.filename ? { filename: attachment.filename } : {}),
    });
  }

  return {
    kind: 'messages',
    system: request.systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };
}

function joinBoundedConversationSections(
  sections: string[]
): string | undefined {
  const trimmed = sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0);
  if (trimmed.length === 0) {
    return undefined;
  }

  let joined = trimmed.join('\n\n');
  if (joined.length > MAX_CONVERSATION_CONTEXT_CHARS) {
    joined = joined.slice(joined.length - MAX_CONVERSATION_CONTEXT_CHARS);
  }

  return joined;
}

function extractMessagePlainText(message: unknown): string {
  if (!message || typeof message !== 'object') {
    return '';
  }

  const record = message as Record<string, unknown>;
  if (typeof record.content === 'string') {
    return record.content.trim();
  }

  const parts = record.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => textFromPart(part))
    .join(' ')
    .trim();
}

function messageHasUserVisibleContent(message: unknown): boolean {
  if (extractMessagePlainText(message).length > 0) {
    return true;
  }
  const parts = (message as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) {
    return false;
  }
  return parts.some(
    (part) =>
      part &&
      typeof part === 'object' &&
      (part as { type?: unknown }).type === 'file'
  );
}

function findLastUserMessageIndex(messages: unknown[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object') {
      continue;
    }

    if ((message as { role?: unknown }).role !== 'user') {
      continue;
    }

    if (messageHasUserVisibleContent(message)) {
      return index;
    }
  }

  return -1;
}

/**
 * Builds a bounded transcript of chat turns **before** the latest user message,
 * for `ContinuumExecutionContext.conversationSummary` (planner and view prompts).
 *
 * @param messages - Same `messages` array as the Vercel AI SDK chat POST body.
 * @param maxChars - Soft cap per section before the global join (default 8000).
 * @returns `undefined` when there is no prior turn, or plain text lines `User:` / `Assistant:` / `System:`.
 */
export function buildConversationTranscriptFromMessages(
  messages: ContinuumVercelAiSdkRouteRequestBody['messages'],
  maxChars = 8000
): string | undefined {
  if (!Array.isArray(messages) || messages.length <= 1) {
    return undefined;
  }

  const lastUserIndex = findLastUserMessageIndex(messages);
  if (lastUserIndex <= 0) {
    return undefined;
  }

  const prior = messages.slice(0, lastUserIndex);
  const lines: string[] = [];

  for (const message of prior) {
    if (!message || typeof message !== 'object') {
      continue;
    }

    const role = (message as { role?: unknown }).role;
    const text = extractMessagePlainText(message);
    if (!text) {
      continue;
    }

    const label =
      role === 'assistant'
        ? 'Assistant'
        : role === 'user'
        ? 'User'
        : role === 'system'
        ? 'System'
        : 'Other';

    lines.push(`${label}: ${text}`);
  }

  if (lines.length === 0) {
    return undefined;
  }

  let result = lines.join('\n');
  if (result.length > maxChars) {
    result = result.slice(result.length - maxChars);
  }

  return `Prior conversation (most recent last):\n${result}`;
}

/**
 * Builds `ContinuumExecutionContext` from a Vercel AI SDK chat POST body (current
 * view, data, merged conversation summary, detached fields, integration catalog,
 * registered actions, chat attachments). Prefer this over ad hoc context objects so planner and
 * view phases receive the same fields as `createContinuumVercelAiSdkRouteHandler`.
 *
 * @param body - Parsed JSON body from `POST` (must include fields the client sent).
 */
export function buildRouteContinuumExecutionContext(
  body: ContinuumVercelAiSdkRouteRequestBody
): ContinuumExecutionContext {
  const explicitSummary =
    typeof body.conversationSummary === 'string' &&
    body.conversationSummary.trim().length > 0
      ? body.conversationSummary.trim()
      : undefined;

  const derivedFromMessages = Array.isArray(body.messages)
    ? buildConversationTranscriptFromMessages(body.messages)
    : undefined;

  const conversationSummary = joinBoundedConversationSections(
    [explicitSummary, derivedFromMessages].filter(
      (section): section is string => typeof section === 'string'
    )
  );

  let detachedFields: ContinuumExecutionContext['detachedFields'];
  if (Array.isArray(body.detachedFields) && body.detachedFields.length > 0) {
    detachedFields = body.detachedFields;
  } else if (
    body.detachedValues &&
    typeof body.detachedValues === 'object' &&
    !Array.isArray(body.detachedValues)
  ) {
    detachedFields = buildDetachedFieldHints(
      body.detachedValues as Record<string, unknown>
    );
  }

  const integrationCatalog =
    body.integrationCatalog &&
    typeof body.integrationCatalog === 'object' &&
    !Array.isArray(body.integrationCatalog)
      ? body.integrationCatalog
      : undefined;

  const registeredActions =
    body.registeredActions &&
    typeof body.registeredActions === 'object' &&
    !Array.isArray(body.registeredActions)
      ? body.registeredActions
      : undefined;

  const chatAttachments = extractChatAttachmentsFromMessages(body.messages);

  return {
    currentView: body.currentView ?? undefined,
    currentData: body.currentData ?? undefined,
    ...(conversationSummary ? { conversationSummary } : {}),
    ...(detachedFields && detachedFields.length > 0 ? { detachedFields } : {}),
    ...(integrationCatalog ? { integrationCatalog } : {}),
    ...(registeredActions ? { registeredActions } : {}),
    ...(chatAttachments.length > 0 ? { chatAttachments } : {}),
  };
}

function textFromPart(part: unknown): string {
  if (!part || typeof part !== 'object') {
    return '';
  }

  const candidate = part as Record<string, unknown>;
  if (candidate.type === 'text' && typeof candidate.text === 'string') {
    return candidate.text;
  }

  return '';
}

export function extractLatestUserInstruction(
  messages: ContinuumVercelAiSdkRouteRequestBody['messages']
): string {
  if (!Array.isArray(messages)) {
    return '';
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object') {
      continue;
    }

    if (
      'role' in message &&
      (message as { role?: unknown }).role === 'user' &&
      typeof (message as { content?: unknown }).content === 'string'
    ) {
      const content = (message as { content: string }).content.trim();
      if (content) {
        return content;
      }
    }

    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    const combined = parts
      .map((part) => textFromPart(part))
      .join(' ')
      .trim();
    if (combined) {
      return combined;
    }
  }

  return '';
}

function toExecutionResponse(
  request: ContinuumExecutionRequest,
  text: string,
  raw: unknown
): ContinuumExecutionResponse {
  return {
    text,
    json: request.outputKind === 'json-object' ? parseJson(text) : null,
    raw,
  };
}

function serializeExecutionRequestForObservability(
  request: ContinuumExecutionRequest
): Record<string, unknown> {
  const { abortSignal: _ignored, ...rest } = request;
  const attachments = rest.attachments;
  if (!attachments?.length) {
    return rest as Record<string, unknown>;
  }
  return {
    ...rest,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      base64: `[base64 ${attachment.base64.length} chars]`,
    })),
  } as Record<string, unknown>;
}

function serializeExecutionResponseForObservability(
  response: ContinuumExecutionResponse
): { text: string; json?: unknown | null } {
  const out: { text: string; json?: unknown | null } = {
    text: response.text,
  };
  if (response.json !== undefined) {
    out.json = response.json;
  }
  return out;
}

function serializeExecutionTraceForObservability(
  trace: ContinuumExecutionTraceEntry[]
): unknown[] {
  return trace.map((entry) => ({
    phase: entry.phase,
    request: serializeExecutionRequestForObservability(entry.request),
    response: serializeExecutionResponseForObservability(entry.response),
  }));
}

/**
 * Builds the same observability payload as the `data-continuum-execution-trace` UI stream
 * part: instruction, per-phase trace with attachment base64 redacted to lengths, and a
 * short result summary.
 */
export function serializeContinuumExecutionForObservability(
  instruction: string,
  result: ContinuumExecutionFinalResult
): ContinuumVercelAiSdkExecutionTraceData {
  return {
    instruction,
    trace: serializeExecutionTraceForObservability(result.trace),
    result: {
      mode: result.mode,
      status: result.status,
      level: result.level,
    },
  };
}

function mergeProviderOptions(
  baseOptions: Record<string, unknown> | undefined,
  requestOptions: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!baseOptions && !requestOptions) {
    return undefined;
  }

  return {
    ...(baseOptions ?? {}),
    ...(requestOptions ?? {}),
  };
}

function writeChunk(
  writer: UIMessageStreamWriter<ContinuumVercelAiSdkMessage>,
  chunk: ContinuumUiChunk
): void {
  writer.write(chunk);
}

function toPatchOperation(
  operation: ViewPatchOperation
): ContinuumViewPatchOperation | null {
  if (!operation || typeof operation !== 'object') {
    return null;
  }

  const candidate = operation as Record<string, unknown>;
  if (candidate.kind === 'insert-node' && candidate.node) {
    return {
      op: 'insert-node',
      parentId:
        typeof candidate.parentId === 'string' || candidate.parentId === null
          ? (candidate.parentId as string | null | undefined)
          : undefined,
      position:
        candidate.position && typeof candidate.position === 'object'
          ? (candidate.position as ContinuumViewPatchPosition)
          : undefined,
      node: candidate.node as Extract<
        ViewPatchOperation,
        { kind: 'insert-node' }
      >['node'],
    };
  }

  if (candidate.kind === 'move-node' && typeof candidate.nodeId === 'string') {
    return {
      op: 'move-node',
      nodeId: candidate.nodeId,
      parentId:
        typeof candidate.parentId === 'string' || candidate.parentId === null
          ? (candidate.parentId as string | null | undefined)
          : undefined,
      position:
        candidate.position && typeof candidate.position === 'object'
          ? (candidate.position as ContinuumViewPatchPosition)
          : undefined,
    };
  }

  if (
    candidate.kind === 'wrap-nodes' &&
    Array.isArray(candidate.nodeIds) &&
    candidate.wrapper
  ) {
    return {
      op: 'wrap-nodes',
      parentId:
        typeof candidate.parentId === 'string' || candidate.parentId === null
          ? (candidate.parentId as string | null | undefined)
          : undefined,
      nodeIds: candidate.nodeIds as string[],
      wrapper: candidate.wrapper as Extract<
        ViewPatchOperation,
        { kind: 'wrap-nodes' }
      >['wrapper'],
    };
  }

  if (
    candidate.kind === 'replace-node' &&
    typeof candidate.nodeId === 'string' &&
    candidate.node
  ) {
    return {
      op: 'replace-node',
      nodeId: candidate.nodeId,
      node: candidate.node as Extract<
        ViewPatchOperation,
        { kind: 'replace-node' }
      >['node'],
    };
  }

  if (
    candidate.kind === 'remove-node' &&
    typeof candidate.nodeId === 'string'
  ) {
    return {
      op: 'remove-node',
      nodeId: candidate.nodeId,
    };
  }

  return null;
}

function normalizeMutationlessExecutionResult(
  result: ContinuumExecutionFinalResult,
  wroteMutation: boolean
): ContinuumExecutionFinalResult {
  if (wroteMutation || result.mode === 'noop' || result.level !== 'success') {
    return result;
  }

  return {
    mode: 'noop',
    source: result.source,
    status:
      result.mode === 'patch'
        ? 'Patch update could not be applied; no changes were made.'
        : result.mode === 'transform'
        ? 'Transform update could not be applied; no changes were made.'
        : 'Continuum completed without applying any changes.',
    level: 'warning',
    trace: result.trace,
    requestedMode: result.mode,
    reason: `The ${result.mode} result did not emit any mutation parts to the UI stream.`,
  };
}

function writeExecutionEvent(
  writer: UIMessageStreamWriter<ContinuumVercelAiSdkMessage>,
  event: ContinuumExecutionEvent,
  viewStreamMode: SessionStreamMode
): WriteExecutionEventResult {
  if (event.kind === 'status') {
    writeChunk(writer, {
      type: 'data-continuum-status',
      data: {
        status: event.status,
        level: event.level,
      },
      transient: event.level === 'info' || event.level === 'warning',
    });
    return { wroteMutation: false };
  }

  if (event.kind === 'state') {
    writeChunk(writer, {
      type: 'data-continuum-state',
      data: {
        nodeId: event.update.nodeId,
        value: event.update.value,
      },
    });
    return { wroteMutation: true };
  }

  if (event.kind === 'patch') {
    const operations: ContinuumViewPatchOperation[] = [];
    let wroteMutation = false;

    for (const operation of event.patchPlan.operations) {
      if (operation.kind === 'append-content') {
        writeChunk(writer, {
          type: 'data-continuum-append-content',
          data: {
            nodeId: operation.nodeId,
            text: operation.text,
            targetViewId: event.currentView.viewId,
          },
        });
        wroteMutation = true;
        continue;
      }

      const patchOperation = toPatchOperation(operation);
      if (patchOperation) {
        operations.push(patchOperation);
      }
    }

    if (operations.length > 0) {
      const patch: ContinuumViewPatch = {
        viewId: event.currentView.viewId,
        version: event.currentView.version,
        operations,
      };

      writeChunk(writer, {
        type: 'data-continuum-patch',
        data: {
          patch,
        },
      });
      wroteMutation = true;
    }

    return { wroteMutation };
  }

  if (event.kind === 'view-preview') {
    writeChunk(writer, {
      type: 'data-continuum-view',
      data: {
        view: event.view,
        streamMode: viewStreamMode,
      },
      transient: true,
    });
    return { wroteMutation: true };
  }

  if (event.kind === 'view-final') {
    writeChunk(writer, {
      type: 'data-continuum-view',
      data: {
        view: event.view,
        ...(event.transformPlan ? { transformPlan: event.transformPlan } : {}),
        streamMode: viewStreamMode,
      },
    });
    return { wroteMutation: true };
  }

  return { wroteMutation: false };
}

async function resolveRouteAdapter(
  options: CreateContinuumVercelAiSdkRouteHandlerOptions,
  request: Request,
  body: ContinuumVercelAiSdkRouteRequestBody
): Promise<ContinuumExecutionAdapter> {
  if (options.resolveAdapter) {
    return options.resolveAdapter({ request, body });
  }

  if (options.adapter) {
    return options.adapter;
  }

  throw new Error(
    'No Continuum execution adapter was configured for this Vercel AI SDK route.'
  );
}

export function createVercelAiSdkContinuumExecutionAdapter(
  options: VercelAiSdkContinuumExecutionAdapterOptions
): ContinuumExecutionAdapter {
  async function resolveModel(
    request: ContinuumExecutionRequest
  ): Promise<LanguageModel> {
    if (options.resolveModel) {
      return options.resolveModel(request);
    }

    if (options.model) {
      return options.model;
    }

    throw new Error('No Vercel AI SDK model was provided.');
  }

  return {
    label: options.label ?? 'Vercel AI SDK',
    async generate(
      request: ContinuumExecutionRequest
    ): Promise<ContinuumExecutionResponse> {
      const model = await resolveModel(request);
      const providerOptions = mergeProviderOptions(
        options.providerOptions,
        await options.resolveProviderOptions?.(request)
      );
      const promptArgs = buildLanguageModelPromptArgs(request);
      const sharedCall = {
        model,
        system: promptArgs.system,
        temperature: resolveTemperatureForLanguageModel(
          model,
          request.temperature
        ),
        maxOutputTokens: request.maxTokens,
        ...(request.abortSignal ? { abortSignal: request.abortSignal } : {}),
        providerOptions: mergeProviderOptions(
          providerOptions,
          request.providerOptions
        ) as never,
      };
      const result =
        promptArgs.kind === 'prompt'
          ? await generateText({
              ...sharedCall,
              prompt: promptArgs.prompt,
            })
          : await generateText({
              ...sharedCall,
              messages: promptArgs.messages,
            });

      return toExecutionResponse(request, result.text, result);
    },
    async *streamText(
      request: ContinuumExecutionRequest
    ): AsyncIterable<string> {
      const model = await resolveModel(request);
      const providerOptions = mergeProviderOptions(
        options.providerOptions,
        await options.resolveProviderOptions?.(request)
      );
      const promptArgs = buildLanguageModelPromptArgs(request);
      const sharedCall = {
        model,
        system: promptArgs.system,
        temperature: resolveTemperatureForLanguageModel(
          model,
          request.temperature
        ),
        maxOutputTokens: request.maxTokens,
        ...(request.abortSignal ? { abortSignal: request.abortSignal } : {}),
        providerOptions: mergeProviderOptions(
          providerOptions,
          request.providerOptions
        ) as never,
      };
      const result =
        promptArgs.kind === 'prompt'
          ? streamText({
              ...sharedCall,
              prompt: promptArgs.prompt,
            })
          : streamText({
              ...sharedCall,
              messages: promptArgs.messages,
            });

      for await (const chunk of result.textStream) {
        yield chunk;
      }
    },
  };
}

export async function writeContinuumExecutionToUiMessageWriter(
  args: WriteContinuumExecutionToUiMessageWriterArgs
): Promise<ContinuumExecutionFinalResult> {
  const stream =
    args.streamContinuumExecution ?? defaultStreamContinuumExecution;
  const iterator = stream({
    adapter: args.adapter,
    instruction: args.instruction,
    context: args.context,
    mode: args.mode,
    addons: args.addons,
    outputContract: args.outputContract,
    authoringFormat: args.authoringFormat,
    autoApplyView: args.autoApplyView,
  });

  let next = await iterator.next();
  let wroteMutation = false;
  while (!next.done) {
    if (next.value.kind !== 'error') {
      const writeResult = writeExecutionEvent(
        args.writer,
        next.value,
        args.viewStreamMode ?? 'draft'
      );
      wroteMutation = wroteMutation || writeResult.wroteMutation;
    }
    next = await iterator.next();
  }

  return normalizeMutationlessExecutionResult(next.value, wroteMutation);
}

export function createContinuumUiMessageStream(
  args: CreateContinuumUiMessageStreamArgs
) {
  return createUIMessageStream<ContinuumVercelAiSdkMessage>({
    execute: async ({ writer }) => {
      try {
        const result = await writeContinuumExecutionToUiMessageWriter({
          writer,
          adapter: args.adapter,
          instruction: args.instruction,
          context: args.context,
          mode: args.mode,
          addons: args.addons,
          outputContract: args.outputContract,
          authoringFormat: args.authoringFormat,
          autoApplyView: args.autoApplyView,
          viewStreamMode: args.viewStreamMode,
          streamContinuumExecution: args.streamContinuumExecution,
        });

        writeChunk(writer, {
          type: 'data-continuum-execution-trace',
          data: serializeContinuumExecutionForObservability(
            args.instruction,
            result
          ),
        });

        if (args.writeFinalStatus ?? true) {
          writeChunk(writer, {
            type: 'data-continuum-status',
            data: {
              status: result.status,
              level: result.level,
            },
          });
        }

        await args.onResult?.(result, writer);
      } catch (error) {
        const normalized = normalizeError(error);

        if (args.writeFinalStatus ?? true) {
          writeChunk(writer, {
            type: 'data-continuum-status',
            data: {
              status: normalized.message,
              level: 'error',
            },
          });
        }

        if (args.writeErrorPart ?? true) {
          writeChunk(writer, {
            type: 'error',
            errorText: normalized.message,
          });
        }

        await args.onError?.(normalized, writer);
      }
    },
  });
}

export function createContinuumVercelAiSdkRouteHandler(
  options: CreateContinuumVercelAiSdkRouteHandlerOptions
): (request: Request) => Promise<Response> {
  return async function handleContinuumVercelAiSdkRoute(
    request: Request
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          allow: 'POST',
        },
      });
    }

    const body = (await request
      .json()
      .catch(() => null)) as ContinuumVercelAiSdkRouteRequestBody | null;

    if (!body || typeof body !== 'object') {
      return new Response('Invalid JSON request body.', {
        status: 400,
      });
    }

    const context = buildRouteContinuumExecutionContext(body);
    const chatAttachments = context.chatAttachments ?? [];
    let instruction =
      body.continuum?.instruction?.trim() ||
      extractLatestUserInstruction(body.messages);
    if (!instruction.trim() && chatAttachments.length > 0) {
      instruction = FALLBACK_INSTRUCTION_FOR_ATTACHMENTS;
    }

    if (!instruction.trim()) {
      return new Response(
        'Add an instruction before sending a Continuum Vercel AI SDK request.',
        {
          status: 400,
        }
      );
    }

    let adapter: ContinuumExecutionAdapter;
    try {
      adapter = await resolveRouteAdapter(options, request, body);
    } catch (error) {
      return new Response(normalizeError(error).message, {
        status: 400,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
        },
      });
    }

    const stream = createContinuumUiMessageStream({
      adapter,
      instruction,
      context,
      mode: body.continuum?.mode ?? options.defaultMode,
      addons: body.continuum?.addons,
      outputContract: body.continuum?.outputContract,
      authoringFormat:
        body.continuum?.authoringFormat ??
        options.defaultAuthoringFormat ??
        'line-dsl',
      autoApplyView: body.continuum?.autoApplyView,
      emitViewPreviews: body.continuum?.emitViewPreviews,
      viewPreviewThrottleMs: body.continuum?.viewPreviewThrottleMs,
      viewStreamMode: options.defaultViewStreamMode,
      streamContinuumExecution: options.streamContinuumExecution,
    });

    return createUIMessageStreamResponse({
      stream,
    });
  };
}
