import type {
  AiConnectClient,
  AiConnectGenerateRequest,
  AiConnectGenerateResult,
  GoogleClientOptions,
} from '../types.js';
import { fetchJson, isSchemaFormatError, parseJsonText } from './shared.js';
import {
  sanitizeGoogleResponseSchema,
  sanitizeStructuredOutputSchema,
} from './schema.js';

function readGoogleContent(raw: unknown): string {
  const response = raw as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

function readGoogleFinishReason(raw: unknown): string | undefined {
  const response = raw as {
    candidates?: Array<{ finishReason?: string }>;
  };
  const reason = response.candidates?.[0]?.finishReason;
  return typeof reason === 'string' ? reason : undefined;
}

export function createGoogleClient(options: GoogleClientOptions): AiConnectClient {
  const baseUrl =
    options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  const defaultModel = options.model ?? 'gemini-2.5-flash';

  return {
    id: options.id ?? 'google',
    label: options.label ?? 'Google Gemini',
    kind: 'google',
    defaultModel,
    supportsJsonSchema: true,
    async generate<TJson>(
      request: AiConnectGenerateRequest
    ): Promise<AiConnectGenerateResult<TJson>> {
      const model = request.model ?? defaultModel;
      const requestedMaxTokens = request.maxTokens ?? 100000;
      const generationConfig: Record<string, unknown> = {
        temperature: request.temperature,
        maxOutputTokens: requestedMaxTokens,
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      };

      if (request.outputContract) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = sanitizeGoogleResponseSchema(
          sanitizeStructuredOutputSchema(request.outputContract.schema)
        );
      }

      const endpoint = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
      const buildBody = (config: Record<string, unknown>) =>
        JSON.stringify({
          systemInstruction: {
            parts: [{ text: request.systemPrompt }],
          },
          contents: [{ role: 'user', parts: [{ text: request.userMessage }] }],
          generationConfig: config,
        });

      let raw: unknown;
      try {
        raw = await fetchJson(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: buildBody(generationConfig),
        });

        let retryCount = 0;
        while (readGoogleFinishReason(raw) === 'MAX_TOKENS' && retryCount < 3) {
          retryCount += 1;
          const retryConfig = {
            ...generationConfig,
            maxOutputTokens: Math.max(requestedMaxTokens, 100000),
          };
          const compactRetryBody = JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: `${request.systemPrompt}\n\nOutput style override: return compact minified JSON only. Avoid optional fields unless required.`,
                },
              ],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: request.userMessage }],
              },
            ],
            generationConfig: retryConfig,
          });
          raw = await fetchJson(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: compactRetryBody,
          });
        }
      } catch (error) {
        if (!request.outputContract || !isSchemaFormatError(error)) {
          throw error;
        }

        const fallbackConfig = { ...generationConfig };
        delete fallbackConfig.responseSchema;
        delete fallbackConfig.responseMimeType;
        raw = await fetchJson(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: buildBody(fallbackConfig),
        });
      }

      const text = readGoogleContent(raw);
      return {
        providerId: options.id ?? 'google',
        model,
        text,
        json: parseJsonText<TJson>(text),
        raw,
      };
    },
  };
}
