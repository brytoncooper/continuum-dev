import type { AIProvider, GenerateResult } from '../types';
import type { ViewDefinition } from '@continuum/contract';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function parseView(raw: string): ViewDefinition {
  return JSON.parse(raw) as ViewDefinition;
}

export const googleProvider: AIProvider = {
  id: 'google',
  name: 'Google Gemini',
  models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  async generate(request): Promise<GenerateResult> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': request.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: request.systemPrompt }],
          },
          contents: request.messages.map((message) => {
            const parts: any[] = [{ text: message.content }];
            
            if (message.attachments) {
              for (const attachment of message.attachments) {
                parts.push({
                  inline_data: {
                    mime_type: attachment.mimeType,
                    data: attachment.base64,
                  },
                });
              }
            }

            return {
              role: message.role === 'assistant' ? 'model' : 'user',
              parts,
            };
          }),
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Gemini request failed (${response.status})`);
    }

    const payload = (await response.json()) as GeminiResponse;
    const rawResponse = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    return {
      view: parseView(rawResponse),
      rawResponse,
      usage: {
        promptTokens: payload.usageMetadata?.promptTokenCount,
        completionTokens: payload.usageMetadata?.candidatesTokenCount,
        totalTokens: payload.usageMetadata?.totalTokenCount,
      },
    };
  },
};
