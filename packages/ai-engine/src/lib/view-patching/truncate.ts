import type { CompactPatchNode } from './types.js';

export const MAX_NODE_HINTS = 2000;
const MAX_CHILDREN_PER_NODE = 40;
const MAX_OPTIONS = 20;
const MAX_DEFAULT_VALUES = 4;
const MAX_OBJECT_KEYS = 12;
const MAX_STRING_LENGTH = 180;

export function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

export function truncateUnknown(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }

  if (depth >= 2) {
    return '[truncated]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_DEFAULT_VALUES)
      .map((entry) => truncateUnknown(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nextValue] of Object.entries(
      value as Record<string, unknown>
    ).slice(0, MAX_OBJECT_KEYS)) {
      result[key] = truncateUnknown(nextValue, depth + 1);
    }
    return result;
  }

  return String(value);
}

export function toValuePreview(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    'value' in (value as Record<string, unknown>)
  ) {
    const nodeValue = (value as Record<string, unknown>).value;
    return truncateUnknown(nodeValue);
  }
  return truncateUnknown(value);
}

export function toCompactPatchNode(input: unknown): CompactPatchNode {
  const source =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const fallbackId =
    typeof source.id === 'string' && source.id.length > 0 ? source.id : 'node';
  const fallbackType =
    typeof source.type === 'string' && source.type.length > 0
      ? source.type
      : 'presentation';

  const compact: CompactPatchNode = {
    id: fallbackId,
    type: fallbackType,
  };

  if (typeof source.key === 'string') compact.key = source.key;
  if (typeof source.semanticKey === 'string') compact.semanticKey = source.semanticKey;
  if (typeof source.label === 'string') compact.label = truncateString(source.label);
  if (typeof source.description === 'string') {
    compact.description = truncateString(source.description);
  }
  if (typeof source.placeholder === 'string') {
    compact.placeholder = truncateString(source.placeholder);
  }
  if (typeof source.dataType === 'string') compact.dataType = source.dataType;
  if (typeof source.contentType === 'string') compact.contentType = source.contentType;
  if (typeof source.content === 'string') compact.content = truncateString(source.content);
  if (typeof source.intentId === 'string') compact.intentId = source.intentId;
  if (typeof source.min === 'number') compact.min = source.min;
  if (typeof source.max === 'number') compact.max = source.max;
  if (typeof source.step === 'number') compact.step = source.step;
  if (typeof source.columns === 'number') compact.columns = source.columns;
  if (typeof source.layout === 'string') compact.layout = source.layout;

  if (typeof source.defaultValue !== 'undefined') {
    compact.defaultValue = truncateUnknown(source.defaultValue);
  }

  if (Array.isArray(source.defaultValues)) {
    compact.defaultValues = source.defaultValues
      .slice(0, MAX_DEFAULT_VALUES)
      .map((entry) => truncateUnknown(entry));
    if (source.defaultValues.length > MAX_DEFAULT_VALUES) {
      compact.defaultValuesTruncatedCount =
        source.defaultValues.length - MAX_DEFAULT_VALUES;
    }
  }

  if (Array.isArray(source.options)) {
    compact.options = source.options
      .slice(0, MAX_OPTIONS)
      .map((option) => {
        const asRecord =
          option && typeof option === 'object'
            ? (option as Record<string, unknown>)
            : {};
        return {
          value:
            typeof asRecord.value === 'string'
              ? truncateString(asRecord.value)
              : String(asRecord.value ?? ''),
          label:
            typeof asRecord.label === 'string'
              ? truncateString(asRecord.label)
              : String(asRecord.label ?? ''),
        };
      });
    if (source.options.length > MAX_OPTIONS) {
      compact.optionsTruncatedCount = source.options.length - MAX_OPTIONS;
    }
  }

  if (Array.isArray(source.children)) {
    compact.children = source.children
      .slice(0, MAX_CHILDREN_PER_NODE)
      .map((child) => toCompactPatchNode(child));
    if (source.children.length > MAX_CHILDREN_PER_NODE) {
      compact.childrenTruncatedCount =
        source.children.length - MAX_CHILDREN_PER_NODE;
    }
  }

  if (source.template && typeof source.template === 'object') {
    compact.template = toCompactPatchNode(source.template);
  }

  return compact;
}
