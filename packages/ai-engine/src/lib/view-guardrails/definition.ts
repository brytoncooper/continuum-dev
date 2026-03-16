import type { ViewDefinition } from '@continuum-dev/core';

export function isViewDefinition(value: unknown): value is ViewDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.viewId === 'string' &&
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.nodes)
  );
}
