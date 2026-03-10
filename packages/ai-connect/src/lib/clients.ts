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

const UNSUPPORTED_ANTHROPIC_SCHEMA_KEYS = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'multipleOf',
  'default',
  'examples',
]);

const SUPPORTED_ANTHROPIC_STRING_FORMATS = new Set([
  'date',
  'date-time',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'time',
  'uri',
  'uuid',
]);

const ANTHROPIC_ANY_JSON_VALUE_SCHEMA = {
  type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isOpenAiStrictCompatibleSchema(value: unknown): boolean {
  if (!isRecord(value)) {
    return true;
  }

  const type = value.type;
  const properties = value.properties;

  if (type === 'object' || isRecord(properties)) {
    if (value.additionalProperties !== false) {
      return false;
    }

    if (!isRecord(properties)) {
      return false;
    }

    const propertyKeys = Object.keys(properties);
    const required = value.required;
    if (!Array.isArray(required)) {
      return false;
    }

    if (required.length !== propertyKeys.length) {
      return false;
    }

    for (const key of propertyKeys) {
      if (!required.includes(key)) {
        return false;
      }
    }
  }

  for (const [key, nextValue] of Object.entries(value)) {
    if (key === 'properties' && isRecord(nextValue)) {
      for (const child of Object.values(nextValue)) {
        if (!isOpenAiStrictCompatibleSchema(child)) {
          return false;
        }
      }
      continue;
    }

    if (key === 'items') {
      if (!isOpenAiStrictCompatibleSchema(nextValue)) {
        return false;
      }
      continue;
    }

    if (Array.isArray(nextValue)) {
      for (const entry of nextValue) {
        if (isRecord(entry) && !isOpenAiStrictCompatibleSchema(entry)) {
          return false;
        }
      }
      continue;
    }

    if (isRecord(nextValue) && !isOpenAiStrictCompatibleSchema(nextValue)) {
      return false;
    }
  }

  return true;
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

  const properties =
    typeof result.properties === 'object' &&
    result.properties !== null &&
    !Array.isArray(result.properties)
      ? (result.properties as Record<string, unknown>)
      : undefined;

  if (properties && !Array.isArray(result.propertyOrdering)) {
    result.propertyOrdering = Object.keys(properties);
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

function sanitizeAnthropicOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAnthropicOutputSchema(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Object.keys(value as Record<string, unknown>).length === 0) {
    return ANTHROPIC_ANY_JSON_VALUE_SCHEMA;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nextValue] of Object.entries(value as Record<string, unknown>)) {
    if (UNSUPPORTED_ANTHROPIC_SCHEMA_KEYS.has(key)) {
      continue;
    }

    if (
      key === 'format' &&
      (typeof nextValue !== 'string' ||
        !SUPPORTED_ANTHROPIC_STRING_FORMATS.has(nextValue))
    ) {
      continue;
    }

    result[key] = sanitizeAnthropicOutputSchema(nextValue);
  }

  const typeAllowsObject =
    result.type === 'object' ||
    (Array.isArray(result.type) && result.type.includes('object'));

  if (
    typeAllowsObject ||
    (typeof result.properties === 'object' &&
      result.properties !== null &&
      !Array.isArray(result.properties))
  ) {
    result.additionalProperties = false;
  }

  return result;
}

function isSchemaFormatError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('response_format') ||
    message.includes('json_schema') ||
    message.includes('output_config') ||
    message.includes('output format') ||
    message.includes('output_format') ||
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
