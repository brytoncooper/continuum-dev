import type {
  AiConnectClient,
  AiConnectGenerateRequest,
  AiConnectGenerateResult,
  AnthropicClientOptions,
  GoogleClientOptions,
  OpenAiClientOptions,
} from './types.js';

const UNSUPPORTED_STRUCTURED_OUTPUT_KEYS = new Set([
  '$defs',
  'definitions',
  '$schema',
  'oneOf',
  'anyOf',
  'allOf',
  'not',
  'if',
  'then',
  'else',
  'dependentSchemas',
  'patternProperties',
]);

function parseJsonText<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AI provider request failed (${response.status} ${response.statusText}): ${body}`
    );
  }
  return response.json();
}

function sanitizeStructuredOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeStructuredOutputSchema(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nextValue] of Object.entries(value as Record<string, unknown>)) {
    if (UNSUPPORTED_STRUCTURED_OUTPUT_KEYS.has(key)) {
      continue;
    }

    if (key === 'const') {
      result.enum = [nextValue];
      continue;
    }

    result[key] = sanitizeStructuredOutputSchema(nextValue);
  }

  return result;
}

function sanitizeGoogleResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeGoogleResponseSchema(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nextValue] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'additionalProperties') {
      continue;
    }

    result[key] = sanitizeGoogleResponseSchema(nextValue);
  }

  if (
    Array.isArray(result.enum) &&
    result.enum.length > 0 &&
    typeof result.type !== 'string'
  ) {
    result.type = 'string';
  }

  return result;
}

function isSchemaFormatError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('response_format') ||
    message.includes('json_schema') ||
    message.includes('response schema') ||
    message.includes('responseschema') ||
    message.includes('response_schema')
  );
}

function readOpenAiContent(raw: unknown): string {
  const response = raw as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
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

export function createOpenAiClient(options: OpenAiClientOptions): AiConnectClient {
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
        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: request.outputContract.name,
            strict: request.outputContract.strict ?? true,
            schema: sanitizeStructuredOutputSchema(request.outputContract.schema),
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
    supportsJsonSchema: false,
    async generate<TJson>(
      request: AiConnectGenerateRequest
    ): Promise<AiConnectGenerateResult<TJson>> {
      const model = request.model ?? defaultModel;
      const raw = await fetchJson(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          temperature: request.temperature,
          max_tokens: request.maxTokens ?? 2048,
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.userMessage }],
        }),
      });

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

export function createGoogleClient(options: GoogleClientOptions): AiConnectClient {
  const baseUrl = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
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
