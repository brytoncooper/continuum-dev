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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeStructuredOutputSchema(value: unknown): unknown {
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

export function isOpenAiStrictCompatibleSchema(value: unknown): boolean {
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

export function sanitizeGoogleResponseSchema(value: unknown): unknown {
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

export function sanitizeAnthropicOutputSchema(value: unknown): unknown {
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
