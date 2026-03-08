import type { PromptOutputContract } from '@continuum-dev/prompts';

export type AiConnectProviderKind = 'openai' | 'anthropic' | 'google';

export interface AiConnectGenerateRequest {
  systemPrompt: string;
  userMessage: string;
  outputContract?: PromptOutputContract;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiConnectGenerateResult<TJson = unknown> {
  providerId: string;
  model: string;
  text: string;
  json: TJson | null;
  raw: unknown;
}

export interface AiConnectClient {
  id: string;
  label: string;
  kind: AiConnectProviderKind;
  defaultModel: string;
  supportsJsonSchema: boolean;
  generate<TJson = unknown>(
    request: AiConnectGenerateRequest
  ): Promise<AiConnectGenerateResult<TJson>>;
}

export interface OpenAiClientOptions {
  apiKey: string;
  id?: string;
  label?: string;
  model?: string;
  baseUrl?: string;
}

export interface AnthropicClientOptions {
  apiKey: string;
  id?: string;
  label?: string;
  model?: string;
  baseUrl?: string;
}

export interface GoogleClientOptions {
  apiKey: string;
  id?: string;
  label?: string;
  model?: string;
  baseUrl?: string;
}

export interface AiConnectGenerateArgs {
  providerId: string;
  request: AiConnectGenerateRequest;
}
