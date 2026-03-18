import {
  createAnthropicClient,
  createGoogleClient,
  createOpenAiClient,
} from '../../index.js';

describe('ai-connect clients', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends sanitized structured output to OpenAI and parses JSON text', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });

    const client = createOpenAiClient({ apiKey: 'test-key' });
    const result = await client.generate<{ ok: boolean }>({
      systemPrompt: 'System',
      userMessage: 'User',
      outputContract: {
        name: 'result',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: {
            status: {
              const: 'ok',
            },
          },
          $schema: 'https://json-schema.org/draft/2020-12/schema',
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const responseFormat = body.response_format as {
      json_schema: { strict: boolean; schema: Record<string, unknown> };
    };

    expect(result.json).toEqual({ ok: true });
    expect(responseFormat.json_schema.strict).toBe(true);
    expect(responseFormat.json_schema.schema).not.toHaveProperty('$schema');
    expect(responseFormat.json_schema.schema).toMatchObject({
      properties: {
        status: {
          enum: ['ok'],
        },
      },
    });
  });

  it('falls back when OpenAI rejects response_format and reads array content responses', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'response_format is invalid',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: [{ text: '{"ok":true}' }],
              },
            },
          ],
        }),
      });

    const client = createOpenAiClient({ apiKey: 'test-key' });
    const result = await client.generate<{ ok: boolean }>({
      systemPrompt: 'System',
      userMessage: 'User',
      outputContract: {
        name: 'result',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
    });

    const firstBody = JSON.parse(
      String(fetchMock.mock.calls[0][1].body)
    ) as Record<string, unknown>;
    const secondBody = JSON.parse(
      String(fetchMock.mock.calls[1][1].body)
    ) as Record<string, unknown>;

    expect(firstBody).toHaveProperty('response_format');
    expect(secondBody).not.toHaveProperty('response_format');
    expect(result.text).toBe('{"ok":true}');
    expect(result.json).toEqual({ ok: true });
  });

  it('falls back when Anthropic rejects output_config', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'response_schema is invalid',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"status":"ok"}' }],
        }),
      });

    const client = createAnthropicClient({ apiKey: 'test-key' });
    const result = await client.generate<{ status: string }>({
      systemPrompt: 'System',
      userMessage: 'User',
      outputContract: {
        name: 'result',
        schema: {
          type: 'object',
          properties: {
            status: { type: 'string', minLength: 1 },
          },
        },
      },
    });

    const firstBody = JSON.parse(
      String(fetchMock.mock.calls[0][1].body)
    ) as Record<string, unknown>;
    const secondBody = JSON.parse(
      String(fetchMock.mock.calls[1][1].body)
    ) as Record<string, unknown>;

    expect(firstBody).toHaveProperty('output_config');
    expect(secondBody).not.toHaveProperty('output_config');
    expect(result.json).toEqual({ status: 'ok' });
  });

  it('retries Google MAX_TOKENS responses with compact output instructions', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              finishReason: 'MAX_TOKENS',
              content: { parts: [{ text: '' }] },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: '{"done":true}' }] },
            },
          ],
        }),
      });

    const client = createGoogleClient({ apiKey: 'test-key' });
    const result = await client.generate<{ done: boolean }>({
      systemPrompt: 'System',
      userMessage: 'User',
      outputContract: {
        name: 'result',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['done'],
          properties: {
            done: { type: 'boolean' },
          },
        },
      },
    });

    const retryBody = JSON.parse(
      String(fetchMock.mock.calls[1][1].body)
    ) as Record<string, unknown>;
    const retryText = (
      (
        ((retryBody.systemInstruction as { parts: Array<{ text: string }> }).parts ??
          [])[0] ?? { text: '' }
      ).text
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryText).toContain('Output style override: return compact minified JSON only.');
    expect(result.json).toEqual({ done: true });
  });

  it('falls back when Google rejects responseSchema', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'response schema is invalid',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: '{"done":true}' }] },
            },
          ],
        }),
      });

    const client = createGoogleClient({ apiKey: 'test-key' });
    const result = await client.generate<{ done: boolean }>({
      systemPrompt: 'System',
      userMessage: 'User',
      outputContract: {
        name: 'result',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['done'],
          properties: {
            done: { type: 'boolean' },
          },
        },
      },
    });

    const firstBody = JSON.parse(
      String(fetchMock.mock.calls[0][1].body)
    ) as { generationConfig: Record<string, unknown> };
    const secondBody = JSON.parse(
      String(fetchMock.mock.calls[1][1].body)
    ) as { generationConfig: Record<string, unknown> };

    expect(firstBody.generationConfig).toHaveProperty('responseSchema');
    expect(firstBody.generationConfig).toHaveProperty('responseMimeType');
    expect(secondBody.generationConfig).not.toHaveProperty('responseSchema');
    expect(secondBody.generationConfig).not.toHaveProperty('responseMimeType');
    expect(result.json).toEqual({ done: true });
  });
});
