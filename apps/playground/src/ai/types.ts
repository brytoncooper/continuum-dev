import type { ReconciliationIssue, ReconciliationResolution } from '@continuum/runtime';
import type { ViewDefinition } from '@continuum/contract';

export type ProviderId = 'openai' | 'google' | 'anthropic';

export interface AIAttachment {
  name: string;
  mimeType: string;
  base64: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachments?: AIAttachment[];
}

export interface GenerateRequest {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  currentView?: ViewDefinition;
  attachments?: AIAttachment[];
}

export interface GenerateResult {
  view: ViewDefinition;
  rawResponse: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIProvider {
  id: ProviderId;
  name: string;
  models: string[];
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export interface AIConversationEntry {
  id: string;
  provider: ProviderId;
  model: string;
  prompt: string;
  createdAt: number;
  rawResponse?: string;
  viewVersion?: string;
  validationErrors?: string[];
  requestError?: string;
  resolutions?: ReconciliationResolution[];
  issues?: ReconciliationIssue[];
  attachments?: AIAttachment[];
}
