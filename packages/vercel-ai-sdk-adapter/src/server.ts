import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  type InferUIMessageChunk,
  type LanguageModel,
  type UIMessage,
  type UIMessageStreamWriter,
} from 'ai';
import type {
  SessionStreamMode,
} from '@continuum-dev/core';
import type {
  ContinuumViewPatch,
  ContinuumViewPatchOperation,
  ContinuumViewPatchPosition,
} from '@continuum-dev/protocol';
import {
  buildDetachedFieldHints,
  parseJson,
  streamContinuumExecution,
  type ContinuumExecutionAdapter,
  type ContinuumExecutionContext,
  type ContinuumExecutionEvent,
  type ContinuumExecutionFinalResult,
  type ContinuumExecutionRequest,
  type ContinuumExecutionResponse,
  type ContinuumExecutionTraceEntry,
  type ContinuumViewAuthoringFormat,
  type ViewPatchOperation,
} from '@continuum-dev/ai-engine';
import type {
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import type { ContinuumVercelAiSdkRequestBody } from './lib/request.js';
import type { ContinuumVercelAiSdkMessage } from './lib/types.js';
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
  viewStreamMode?: SessionStreamMode;
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

function buildRouteContinuumExecutionContext(
  body: ContinuumVercelAiSdkRequestBody
): ContinuumExecutionContext {
  const conversationSummary =
    typeof body.conversationSummary === 'string' &&
    body.conversationSummary.trim().length > 0
      ? body.conversationSummary.trim()
      : undefined;

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

  return {
    currentView: body.currentView ?? undefined,
    currentData: body.currentData ?? undefined,
    ...(conversationSummary ? { conversationSummary } : {}),
    ...(detachedFields && detachedFields.length > 0 ? { detachedFields } : {}),
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
  return rest as Record<string, unknown>;
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

  if (
    candidate.kind === 'move-node' &&
    typeof candidate.nodeId === 'string'
  ) {
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
        ...(event.transformPlan
          ? { transformPlan: event.transformPlan }
          : {}),
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
      const result = await generateText({
        model,
        system: request.systemPrompt,
        prompt: request.userMessage,
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
      const result = streamText({
        model,
        system: request.systemPrompt,
        prompt: request.userMessage,
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
  const iterator = streamContinuumExecution({
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
        });

        writeChunk(writer, {
          type: 'data-continuum-execution-trace',
          data: {
            instruction: args.instruction,
            trace: serializeExecutionTraceForObservability(result.trace),
            result: {
              mode: result.mode,
              status: result.status,
              level: result.level,
            },
          },
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

    const body =
      (await request
        .json()
        .catch(() => null)) as ContinuumVercelAiSdkRouteRequestBody | null;

    if (!body || typeof body !== 'object') {
      return new Response('Invalid JSON request body.', {
        status: 400,
      });
    }

    const instruction =
      body.continuum?.instruction?.trim() ||
      extractLatestUserInstruction(body.messages);

    if (!instruction) {
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
      context: buildRouteContinuumExecutionContext(body),
      mode: body.continuum?.mode ?? options.defaultMode,
      addons: body.continuum?.addons,
      outputContract: body.continuum?.outputContract,
      authoringFormat:
        body.continuum?.authoringFormat ??
        options.defaultAuthoringFormat ??
        'line-dsl',
      autoApplyView: body.continuum?.autoApplyView,
      viewStreamMode: options.defaultViewStreamMode,
    });

    return createUIMessageStreamResponse({
      stream,
    });
  };
}
