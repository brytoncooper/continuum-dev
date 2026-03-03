import type { AIProvider, GenerateResult } from '../types';
import type { ViewDefinition } from '@continuum/contract';

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

function parseView(raw: string): ViewDefinition {
  return JSON.parse(raw) as ViewDefinition;
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest'],
  async generate(request): Promise<GenerateResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 2048,
        system: request.systemPrompt,
        messages: request.messages
          .filter((message) => message.role !== 'system')
          .map((message) => {
            const content: any[] = [{ type: 'text', text: message.content }];

            if (message.attachments) {
              for (const attachment of message.attachments) {
                if (attachment.mimeType.startsWith('image/')) {
                  content.push({
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: attachment.mimeType,
                      data: attachment.base64,
                    },
                  });
                } else if (attachment.mimeType === 'application/pdf') {
                  content.push({
                    type: 'document',
                    source: {
                      type: 'base64',
                      media_type: 'application/pdf',
                      data: attachment.base64,
                    },
                  });
                }
              }
            }

            return {
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content,
            };
          }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status})`);
    }

    const payload = (await response.json()) as AnthropicResponse;
    const rawResponse = payload.content?.find((entry) => entry.type === 'text')?.text ?? '{}';

    return {
      view: parseView(rawResponse),
      rawResponse,
      usage: {
        promptTokens: payload.usage?.input_tokens,
        completionTokens: payload.usage?.output_tokens,
        totalTokens:
          (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0),
      },
    };
  },
};
