import type { ViewDefinition } from '@continuum-dev/core';
import {
  isViewDefinition,
  parseJson,
  sanitizeJsonViewDefinition,
} from '../../view-guardrails/index.js';

/**
 * Resolves a `ViewDefinition` from structured output: prefers `json` when valid,
 * otherwise parses JSON from `text`.
 *
 * @returns `null` if neither `json` nor `text` yields a valid view shape.
 */
export function parseViewJsonToViewDefinition(args: {
  text: string;
  json?: unknown | null;
}): ViewDefinition | null {
  if (args.json !== undefined && args.json !== null && isViewDefinition(args.json)) {
    return sanitizeJsonViewDefinition(args.json);
  }

  const parsed = parseJson<unknown>(args.text);
  if (parsed && isViewDefinition(parsed)) {
    return sanitizeJsonViewDefinition(parsed);
  }

  return null;
}
