import type { ViewDefinition } from '@continuum-dev/core';

function stripLeadingJsonQuoteArtifactChars(value: string): string {
  let result = value;
  let depth = 0;
  const maxStrips = 4;
  while (depth < maxStrips && result.startsWith('"') && result.length > 1) {
    result = result.slice(1);
    depth += 1;
  }
  return result;
}

function sanitizeJsonViewStringArtifacts(value: unknown): unknown {
  if (typeof value === 'string') {
    return stripLeadingJsonQuoteArtifactChars(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonViewStringArtifacts);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      next[key] = sanitizeJsonViewStringArtifacts(entry);
    }
    return next;
  }
  return value;
}

/**
 * Removes stray leading `"` characters from string fields in a view definition
 * produced by `JSON.parse` when streamed model output mis-escapes string values.
 *
 * @param view - Parsed JSON view definition before normalization.
 * @returns The same structure with sanitized string leaves.
 */
export function sanitizeJsonViewDefinition(view: ViewDefinition): ViewDefinition {
  return sanitizeJsonViewStringArtifacts(view) as ViewDefinition;
}
