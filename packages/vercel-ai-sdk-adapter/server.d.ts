import { type InferUIMessageChunk, type LanguageModel, type UIMessage, type UIMessageStreamWriter } from 'ai';
import type { SessionStreamMode } from '@continuum-dev/core';
import { type ContinuumExecutionAdapter, type ContinuumExecutionContext, type ContinuumExecutionFinalResult, type ContinuumExecutionRequest, type ContinuumViewAuthoringFormat } from '@continuum-dev/ai-engine';
import type { PromptAddon, PromptMode, PromptOutputContract } from '@continuum-dev/prompts';
import type { ContinuumVercelAiSdkRequestBody } from './lib/request.js';
import type { ContinuumVercelAiSdkMessage } from './lib/types.js';
export interface VercelAiSdkContinuumExecutionAdapterOptions {
    label?: string;
    model?: LanguageModel;
    resolveModel?: (request: ContinuumExecutionRequest) => Promise<LanguageModel> | LanguageModel;
    providerOptions?: Record<string, unknown>;
    resolveProviderOptions?: (request: ContinuumExecutionRequest) => Promise<Record<string, unknown> | undefined> | Record<string, unknown> | undefined;
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
export interface CreateContinuumUiMessageStreamArgs extends Omit<WriteContinuumExecutionToUiMessageWriterArgs, 'writer'> {
    writeFinalStatus?: boolean;
    writeErrorPart?: boolean;
    onResult?: (result: ContinuumExecutionFinalResult, writer: UIMessageStreamWriter<ContinuumVercelAiSdkMessage>) => Promise<void> | void;
    onError?: (error: Error, writer: UIMessageStreamWriter<ContinuumVercelAiSdkMessage>) => Promise<void> | void;
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
export type ContinuumVercelAiSdkRouteRequestBody = ContinuumVercelAiSdkRequestBody & {
    messages?: Array<UIMessage | Record<string, unknown>>;
} & Record<string, unknown>;
export declare function extractLatestUserInstruction(messages: ContinuumVercelAiSdkRouteRequestBody['messages']): string;
export declare function createVercelAiSdkContinuumExecutionAdapter(options: VercelAiSdkContinuumExecutionAdapterOptions): ContinuumExecutionAdapter;
export declare function writeContinuumExecutionToUiMessageWriter(args: WriteContinuumExecutionToUiMessageWriterArgs): Promise<ContinuumExecutionFinalResult>;
export declare function createContinuumUiMessageStream(args: CreateContinuumUiMessageStreamArgs): ReadableStream<InferUIMessageChunk<ContinuumVercelAiSdkMessage>>;
export declare function createContinuumVercelAiSdkRouteHandler(options: CreateContinuumVercelAiSdkRouteHandlerOptions): (request: Request) => Promise<Response>;
//# sourceMappingURL=server.d.ts.map