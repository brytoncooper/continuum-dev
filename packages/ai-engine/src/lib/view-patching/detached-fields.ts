import type { DetachedFieldHint } from '@continuum-dev/prompts';
import { toValuePreview, truncateString } from './truncate.js';

export function buildDetachedFieldHints(
  detachedValues: Record<string, unknown>
): DetachedFieldHint[] {
  const hints: DetachedFieldHint[] = [];

  for (const [detachedKey, value] of Object.entries(detachedValues)) {
    if (!value || typeof value !== 'object') {
      continue;
    }

    const record = value as Record<string, unknown>;
    const previousNodeType =
      typeof record.previousNodeType === 'string'
        ? record.previousNodeType
        : 'unknown';
    const reason =
      typeof record.reason === 'string' ? record.reason : 'node-removed';
    const viewVersion =
      typeof record.viewVersion === 'string' ? record.viewVersion : 'unknown';
    const semanticKey = typeof record.key === 'string' ? record.key : undefined;
    const previousLabel =
      typeof record.previousLabel === 'string'
        ? truncateString(record.previousLabel)
        : undefined;
    const previousParentLabel =
      typeof record.previousParentLabel === 'string'
        ? truncateString(record.previousParentLabel)
        : undefined;

    const hint: DetachedFieldHint = {
      detachedKey,
      previousNodeType,
      reason,
      viewVersion,
      valuePreview: toValuePreview(record.value),
    };

    if (semanticKey) {
      hint.key = semanticKey;
    }
    if (previousLabel) {
      hint.previousLabel = previousLabel;
    }
    if (previousParentLabel) {
      hint.previousParentLabel = previousParentLabel;
    }

    hints.push(hint);
  }

  return hints.slice(0, 64);
}
