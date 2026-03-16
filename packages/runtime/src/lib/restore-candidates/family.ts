import type { DetachedValue, ViewNode } from '@continuum-dev/contract';
import type { RestoreFamily } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeValuePreview(value: unknown): unknown {
  if (isRecord(value) && 'value' in value) {
    return value.value;
  }
  return value;
}

export function determineNodeFamily(node: ViewNode): RestoreFamily | null {
  switch (node.type) {
    case 'field': {
      if (Array.isArray(node.options) && node.options.length > 0) {
        return 'choice';
      }
      if (node.dataType === 'number') {
        return 'number';
      }
      if (node.dataType === 'boolean') {
        return 'boolean';
      }
      if (node.dataType === 'string') {
        return 'text';
      }
      return null;
    }
    default:
      return null;
  }
}

export function determineDetachedFamily(
  detachedValue: DetachedValue
): RestoreFamily | null {
  switch (detachedValue.previousNodeType) {
    case 'textarea':
      return 'text';
    case 'toggle':
      return 'boolean';
    case 'slider':
      return 'number';
    case 'select':
    case 'radio-group':
      return 'choice';
    case 'field': {
      const preview = normalizeValuePreview(detachedValue.value);
      if (typeof preview === 'number') {
        return 'number';
      }
      if (typeof preview === 'boolean') {
        return 'boolean';
      }
      if (
        typeof preview === 'string' ||
        preview === null ||
        preview === undefined
      ) {
        return 'text';
      }
      return null;
    }
    default:
      return null;
  }
}
