import type { ViewDefinition } from '@continuum/contract';
import type { ChatMessage, ProviderId, AIAttachment } from './types';

export interface GenerateViewRequest {
  provider: ProviderId;
  model: string;
  apiKey: string;
  systemPrompt: string;
  messages: ChatMessage[];
  currentView?: ViewDefinition;
  attachments?: AIAttachment[];
}

export interface GenerateViewResponse {
  view: ViewDefinition;
  rawResponse: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export async function generateView(request: GenerateViewRequest): Promise<GenerateViewResponse> {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': request.apiKey,
    },
    body: JSON.stringify({
      provider: request.provider,
      model: request.model,
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      currentView: request.currentView,
      attachments: request.attachments,
    }),
  });

  const payload = (await response.json()) as GenerateViewResponse & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `AI request failed (${response.status})`);
  }
  return payload;
}
