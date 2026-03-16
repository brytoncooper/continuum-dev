import type {
  AiConnectClient,
  AiConnectGenerateRequest,
  AiConnectGenerateResult,
  AnthropicClientOptions,
} from '../types.js';
import { fetchJson, isSchemaFormatError, parseJsonText } from './shared.js';
import {
  sanitizeAnthropicOutputSchema,
  sanitizeStructuredOutputSchema,
} from './schema.js';

function readAnthropicContent(raw: unknown): string {
  const response = raw as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (response.content ?? [])
    .filter((part) => part?.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

function buildAnthropicSystemPrompt(prompt: string, model: string): string {
  return [
    '<role>',
    `You are Claude, created by Anthropic. The current model is ${model}.`,
    '</role>',
    '<instructions>',
    'Follow the instructions exactly and directly.',
    'Be clear, specific, and grounded.',
    'Prefer a simple valid result over an ambitious invalid one.',
    prompt,
    '</instructions>',
  ].join('\n');
}

function buildAnthropicUserMessage(message: string): string {
  return ['<input>', message.trim(), '</input>'].join('\n');
}

export function createAnthropicClient(
  options: AnthropicClientOptions
): AiConnectClient {
  const baseUrl = options.baseUrl ?? 'https://api.anthropic.com/v1';
  const defaultModel = options.model ?? 'claude-sonnet-4-6';

  return {
    id: options.id ?? 'anthropic',
    label: options.label ?? 'Anthropic',
    kind: 'anthropic',
    defaultModel,
    supportsJsonSchema: true,
    async generate<TJson>(
      request: AiConnectGenerateRequest
    ): Promise<AiConnectGenerateResult<TJson>> {
      const model = request.model ?? defaultModel;
      const body: Record<string, unknown> = {
        model,
        temperature: request.temperature,
        max_tokens: request.maxTokens ?? 64000,
        system: buildAnthropicSystemPrompt(request.systemPrompt, model),
        messages: [
          {
            role: 'user',
            content: buildAnthropicUserMessage(request.userMessage),
          },
        ],
      };

      if (request.outputContract) {
        body.output_config = {
          format: {
            type: 'json_schema',
            schema: sanitizeAnthropicOutputSchema(
              sanitizeStructuredOutputSchema(request.outputContract.schema)
            ),
          },
        };
      }

      const requestConfig = {
        method: 'POST',
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
      } satisfies Omit<RequestInit, 'body'>;

      let raw: unknown;
      try {
        raw = await fetchJson(`${baseUrl}/messages`, {
          ...requestConfig,
          body: JSON.stringify(body),
        });
      } catch (error) {
        if (!request.outputContract || !isSchemaFormatError(error)) {
          throw error;
        }

        const fallbackBody = { ...body };
        delete fallbackBody.output_config;
        raw = await fetchJson(`${baseUrl}/messages`, {
          ...requestConfig,
          body: JSON.stringify(fallbackBody),
        });
      }

      const text = readAnthropicContent(raw);
      return {
        providerId: options.id ?? 'anthropic',
        model,
        text,
        json: parseJsonText<TJson>(text),
        raw,
      };
    },
  };
}
