import type { ViewDefinition } from '@continuum-dev/core';
import type { DetachedFieldHint } from '@continuum-dev/prompts';

const MAX_NODE_HINTS = 2000;
const MAX_CHILDREN_PER_NODE = 40;
const MAX_OPTIONS = 20;
const MAX_DEFAULT_VALUES = 4;
const MAX_OBJECT_KEYS = 12;
const MAX_STRING_LENGTH = 180;

export interface PatchNodeHint {
  path: string;
  id: string;
  parentPath?: string;
  key?: string;
  semanticKey?: string;
  type?: string;
  label?: string;
  description?: string;
  columns?: number;
  layout?: string;
  defaultValue?: unknown;
  childrenCount?: number;
  hasTemplate?: boolean;
}

export interface CompactPatchNode {
  id: string;
  type: string;
  key?: string;
  semanticKey?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  dataType?: string;
  contentType?: string;
  content?: string;
  intentId?: string;
  min?: number;
  max?: number;
  step?: number;
  columns?: number;
  layout?: string;
  defaultValue?: unknown;
  defaultValues?: unknown[];
  options?: Array<{ value: string; label: string }>;
  children?: CompactPatchNode[];
  template?: CompactPatchNode;
  childrenTruncatedCount?: number;
  optionsTruncatedCount?: number;
  defaultValuesTruncatedCount?: number;
}

export interface PatchContextPayload {
  nodeHints: PatchNodeHint[];
  compactTree: CompactPatchNode[];
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

function truncateUnknown(value: unknown, depth = 0): unknown {
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
    for (const [key, nextValue] of Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS
    )) {
      result[key] = truncateUnknown(nextValue, depth + 1);
    }
    return result;
  }

  return String(value);
}

function toValuePreview(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    const nodeValue = (value as Record<string, unknown>).value;
    return truncateUnknown(nodeValue);
  }
  return truncateUnknown(value);
}

function toCompactPatchNode(input: unknown): CompactPatchNode {
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
    const semanticKey =
      typeof record.key === 'string' ? record.key : undefined;
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

export function buildPatchContext(view: ViewDefinition): PatchContextPayload {
  const nodeHints: PatchNodeHint[] = [];

  const walkHints = (
    nodes: unknown[],
    parentPath: string,
    parentNodePath?: string
  ): void => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        continue;
      }
      const asRecord = node as Record<string, unknown>;
      const id =
        typeof asRecord.id === 'string' && asRecord.id.length > 0
          ? asRecord.id
          : 'node';
      const path = parentPath.length > 0 ? `${parentPath}/${id}` : id;

      nodeHints.push({
        path,
        id,
        parentPath: parentNodePath,
        key: typeof asRecord.key === 'string' ? asRecord.key : undefined,
        semanticKey:
          typeof asRecord.semanticKey === 'string'
            ? asRecord.semanticKey
            : undefined,
        type: typeof asRecord.type === 'string' ? asRecord.type : undefined,
        label: typeof asRecord.label === 'string' ? truncateString(asRecord.label) : undefined,
        description:
          typeof asRecord.description === 'string'
            ? truncateString(asRecord.description)
            : undefined,
        columns:
          typeof asRecord.columns === 'number' ? asRecord.columns : undefined,
        layout: typeof asRecord.layout === 'string' ? asRecord.layout : undefined,
        defaultValue:
          typeof asRecord.defaultValue !== 'undefined'
            ? truncateUnknown(asRecord.defaultValue)
            : undefined,
        childrenCount: Array.isArray(asRecord.children)
          ? asRecord.children.length
          : undefined,
        hasTemplate:
          !!asRecord.template && typeof asRecord.template === 'object',
      });

      if (Array.isArray(asRecord.children)) {
        walkHints(asRecord.children, path, path);
      }

      if (asRecord.template && typeof asRecord.template === 'object') {
        walkHints([asRecord.template], path, path);
      }
    }
  };

  walkHints(view.nodes as unknown[], '', undefined);

  return {
    nodeHints: nodeHints.slice(0, MAX_NODE_HINTS),
    compactTree: (view.nodes as unknown[]).map((node) => toCompactPatchNode(node)),
  };
}
