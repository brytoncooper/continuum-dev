import {
  type InferUIMessageChunk,
  type LanguageModel,
  type UIMessage,
  type UIMessageStreamWriter,
} from 'ai';
import type { SessionStreamMode } from '@continuum-dev/core';
import {
  type ContinuumChatAttachment,
  type ContinuumExecutionAdapter,
  type ContinuumExecutionContext,
  type ContinuumExecutionEvent,
  type ContinuumExecutionFinalResult,
  type ContinuumExecutionMode,
  type ContinuumExecutionPlan,
  type ContinuumExecutionRequest,
  type ContinuumViewAuthoringFormat,
  type StreamContinuumExecutionArgs,
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

export type StreamContinuumExecutionFn = (
  args: StreamContinuumExecutionArgs
) => AsyncGenerator<ContinuumExecutionEvent, ContinuumExecutionFinalResult>;

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
  executionMode?: ContinuumExecutionMode;
  executionPlan?: ContinuumExecutionPlan;
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
/**
 * Collects user file parts from the **latest** user message in a Vercel AI SDK
 * chat `messages` array. Only `data:` URLs with a `;base64,` payload are
 * supported (matching typical browser `FileUIPart` serialization).
 *
 * @param messages - Same `messages` array as the chat POST body.
 * @returns Attachments in adapter-ready form, newest user message only.
 */
export declare function extractChatAttachmentsFromMessages(
  messages: ContinuumVercelAiSdkRouteRequestBody['messages']
): ContinuumChatAttachment[];
/**
 * Builds a bounded transcript of chat turns **before** the latest user message,
 * for `ContinuumExecutionContext.conversationSummary` (planner and view prompts).
 *
 * @param messages - Same `messages` array as the Vercel AI SDK chat POST body.
 * @param maxChars - Soft cap per section before the global join (default 8000).
 * @returns `undefined` when there is no prior turn, or plain text lines `User:` / `Assistant:` / `System:`.
 */
export declare function buildConversationTranscriptFromMessages(
  messages: ContinuumVercelAiSdkRouteRequestBody['messages'],
  maxChars?: number
): string | undefined;
/**
 * Builds `ContinuumExecutionContext` from a Vercel AI SDK chat POST body (current
 * view, data, merged conversation summary, detached fields, integration catalog,
 * registered actions, chat attachments). Prefer this over ad hoc context objects so planner and
 * view phases receive the same fields as `createContinuumVercelAiSdkRouteHandler`.
 *
 * @param body - Parsed JSON body from `POST` (must include fields the client sent).
 */
export declare function buildRouteContinuumExecutionContext(
  body: ContinuumVercelAiSdkRouteRequestBody
): ContinuumExecutionContext;
export declare function extractLatestUserInstruction(
  messages: ContinuumVercelAiSdkRouteRequestBody['messages']
): string;
/**
 * Builds the same observability payload as the `data-continuum-execution-trace` UI stream
 * part: instruction, per-phase trace with attachment base64 redacted to lengths, and a
 * short result summary.
 */
export declare function serializeContinuumExecutionForObservability(
  instruction: string,
  result: ContinuumExecutionFinalResult
): ContinuumVercelAiSdkExecutionTraceData;
export declare function createVercelAiSdkContinuumExecutionAdapter(
  options: VercelAiSdkContinuumExecutionAdapterOptions
): ContinuumExecutionAdapter;
export declare function writeContinuumExecutionToUiMessageWriter(
  args: WriteContinuumExecutionToUiMessageWriterArgs
): Promise<ContinuumExecutionFinalResult>;
export declare function createContinuumUiMessageStream(
  args: CreateContinuumUiMessageStreamArgs
): ReadableStream<InferUIMessageChunk<ContinuumVercelAiSdkMessage>>;
export declare function createContinuumVercelAiSdkRouteHandler(
  options: CreateContinuumVercelAiSdkRouteHandlerOptions
): (request: Request) => Promise<Response>;
//# sourceMappingURL=server.d.ts.map
