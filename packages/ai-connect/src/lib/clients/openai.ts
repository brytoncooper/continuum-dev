import type {
  AiConnectClient,
  AiConnectGenerateRequest,
  AiConnectGenerateResult,
  OpenAiClientOptions,
} from '../types.js';
import { fetchJson, isSchemaFormatError, parseJsonText } from './shared.js';
import {
  isOpenAiStrictCompatibleSchema,
  sanitizeStructuredOutputSchema,
} from './schema.js';

function readOpenAiContent(raw: unknown): string {
  const response = raw as {
    choices?: Array<{
      message?: { content?: string | Array<{ text?: string }> };
    }>;
  };
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text ?? '')
      .join('')
      .trim();
  }
  return '';
}

export function createOpenAiClient(
  options: OpenAiClientOptions
): AiConnectClient {
  const baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  const defaultModel = options.model ?? 'gpt-5.4';

  return {
    id: options.id ?? 'openai',
    label: options.label ?? 'OpenAI',
    kind: 'openai',
    defaultModel,
    supportsJsonSchema: true,
    async generate<TJson>(
      request: AiConnectGenerateRequest
    ): Promise<AiConnectGenerateResult<TJson>> {
      const model = request.model ?? defaultModel;
      const body: Record<string, unknown> = {
        model,
        temperature: request.temperature,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userMessage },
        ],
      };

      if (request.outputContract) {
        const sanitizedSchema = sanitizeStructuredOutputSchema(
          request.outputContract.schema
        );
        const strictRequested = request.outputContract.strict ?? false;
        const strict =
          strictRequested && isOpenAiStrictCompatibleSchema(sanitizedSchema);

        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: request.outputContract.name,
            strict,
            schema: sanitizedSchema,
          },
        };
      }

      const requestConfig = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${options.apiKey}`,
        },
      } satisfies Omit<RequestInit, 'body'>;

      let raw: unknown;
      try {
        raw = await fetchJson(`${baseUrl}/chat/completions`, {
          ...requestConfig,
          body: JSON.stringify(body),
        });
      } catch (error) {
        if (!request.outputContract || !isSchemaFormatError(error)) {
          throw error;
        }

        const fallbackBody = { ...body };
        delete fallbackBody.response_format;
        raw = await fetchJson(`${baseUrl}/chat/completions`, {
          ...requestConfig,
          body: JSON.stringify(fallbackBody),
        });
      }

      const text = readOpenAiContent(raw);
      return {
        providerId: options.id ?? 'openai',
        model,
        text,
        json: parseJsonText<TJson>(text),
        raw,
      };
    },
  };
}
