import {
  isOpenAiStrictCompatibleSchema,
  sanitizeAnthropicOutputSchema,
  sanitizeGoogleResponseSchema,
  sanitizeStructuredOutputSchema,
} from './schema.js';

describe('sanitizeStructuredOutputSchema', () => {
  it('removes unsupported keywords and normalizes const values recursively', () => {
    const schema = sanitizeStructuredOutputSchema({
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          const: 'ok',
        },
        tags: {
          type: 'array',
          items: [{ const: 'stable' }],
        },
        meta: {
          type: 'string',
          oneOf: [{ type: 'string' }],
        },
      },
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      allOf: [{ type: 'object' }],
    });

    expect(schema).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          enum: ['ok'],
        },
        tags: {
          type: 'array',
          items: [{ enum: ['stable'] }],
        },
        meta: {
          type: 'string',
        },
      },
    });
  });
});

describe('isOpenAiStrictCompatibleSchema', () => {
  it('accepts strict object schemas when every property is required recursively', () => {
    expect(
      isOpenAiStrictCompatibleSchema({
        type: 'object',
        additionalProperties: false,
        required: ['status', 'details'],
        properties: {
          status: { type: 'string' },
          details: {
            type: 'object',
            additionalProperties: false,
            required: ['count'],
            properties: {
              count: { type: 'number' },
            },
          },
        },
      })
    ).toBe(true);
  });

  it('rejects schemas that omit additionalProperties or required keys', () => {
    expect(
      isOpenAiStrictCompatibleSchema({
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string' },
        },
      })
    ).toBe(false);

    expect(
      isOpenAiStrictCompatibleSchema({
        type: 'object',
        additionalProperties: false,
        required: ['details'],
        properties: {
          details: {
            type: 'object',
            additionalProperties: false,
            required: [],
            properties: {
              count: { type: 'number' },
            },
          },
        },
      })
    ).toBe(false);
  });
});

describe('sanitizeGoogleResponseSchema', () => {
  it('drops additionalProperties, infers propertyOrdering, and coerces enum-only fields to strings', () => {
    const schema = sanitizeGoogleResponseSchema({
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          enum: ['ok', 'error'],
        },
        details: {
          type: 'object',
          additionalProperties: false,
          properties: {
            count: { type: 'number' },
          },
        },
      },
    });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        status: {
          enum: ['ok', 'error'],
          type: 'string',
        },
        details: {
          type: 'object',
          properties: {
            count: { type: 'number' },
          },
          propertyOrdering: ['count'],
        },
      },
      propertyOrdering: ['status', 'details'],
    });
  });

  it('preserves an explicit property ordering when one is already provided', () => {
    const schema = sanitizeGoogleResponseSchema({
      type: 'object',
      properties: {
        alpha: { type: 'string' },
        beta: { type: 'string' },
      },
      propertyOrdering: ['beta', 'alpha'],
    });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        alpha: { type: 'string' },
        beta: { type: 'string' },
      },
      propertyOrdering: ['beta', 'alpha'],
    });
  });
});

describe('sanitizeAnthropicOutputSchema', () => {
  it('expands empty objects into a permissive any-json schema', () => {
    expect(sanitizeAnthropicOutputSchema({})).toEqual({
      type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
    });
  });

  it('removes unsupported constraints while keeping Anthropic-safe object schemas closed', () => {
    const schema = sanitizeAnthropicOutputSchema({
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
        },
        timestamp: {
          type: 'string',
          format: 'regex',
        },
        score: {
          type: 'number',
          minimum: 0,
        },
        metadata: {},
      },
    });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
        },
        timestamp: {
          type: 'string',
        },
        score: {
          type: 'number',
        },
        metadata: {
          type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
        },
      },
      additionalProperties: false,
    });
  });
});
