import type { ViewDefinition } from '@continuum-dev/core';

const PREVIEW_VIEW_OR_NODE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const PREVIEW_SEMANTIC_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
const PREVIEW_INTENT_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;

function isPlausibleViewIdForPreview(id: string): boolean {
  return PREVIEW_VIEW_OR_NODE_ID_PATTERN.test(id);
}

function isPlausibleNodeIdForPreview(id: string): boolean {
  return PREVIEW_VIEW_OR_NODE_ID_PATTERN.test(id);
}

function isPlausibleSemanticKeyForPreview(key: string | undefined): boolean {
  if (key === undefined || key.length === 0) {
    return true;
  }
  return PREVIEW_SEMANTIC_KEY_PATTERN.test(key);
}

function isPlausibleIntentIdForPreview(intentId: string | undefined): boolean {
  if (intentId === undefined || intentId.length === 0) {
    return true;
  }
  return PREVIEW_INTENT_ID_PATTERN.test(intentId);
}

function isPlausibleStreamingTextField(value: string | undefined): boolean {
  if (value === undefined || value.length === 0) {
    return true;
  }
  if (/^["'`]+$/.test(value)) {
    return false;
  }
  const first = value[0];
  if ((first === '"' || first === "'") && value.length > 1) {
    return false;
  }
  return true;
}

function viewNodePassesPreviewQualityGate(
  node: ViewDefinition['nodes'][number]
): boolean {
  if (!isPlausibleNodeIdForPreview(node.id)) {
    return false;
  }

  const record = node as unknown as Record<string, unknown>;

  if (typeof record.key === 'string' && record.key.length > 0) {
    if (!PREVIEW_SEMANTIC_KEY_PATTERN.test(record.key)) {
      return false;
    }
  }

  if (typeof record.semanticKey === 'string') {
    if (!isPlausibleSemanticKeyForPreview(record.semanticKey)) {
      return false;
    }
  }

  if (typeof record.intentId === 'string') {
    if (!isPlausibleIntentIdForPreview(record.intentId)) {
      return false;
    }
  }

  if (typeof record.label === 'string') {
    if (!isPlausibleStreamingTextField(record.label)) {
      return false;
    }
  }

  if (typeof record.defaultValue === 'string') {
    if (!isPlausibleStreamingTextField(record.defaultValue)) {
      return false;
    }
  }

  if (typeof record.content === 'string') {
    if (!isPlausibleStreamingTextField(record.content)) {
      return false;
    }
  }

  const options = record.options;
  if (Array.isArray(options)) {
    for (const option of options) {
      if (!option || typeof option !== 'object') {
        return false;
      }
      const optionRecord = option as Record<string, unknown>;
      if (typeof optionRecord.value === 'string') {
        if (!isPlausibleStreamingTextField(optionRecord.value)) {
          return false;
        }
      }
      if (typeof optionRecord.label === 'string') {
        if (!isPlausibleStreamingTextField(optionRecord.label)) {
          return false;
        }
      }
    }
  }

  if ('children' in node && node.children) {
    for (const child of node.children) {
      if (!viewNodePassesPreviewQualityGate(child)) {
        return false;
      }
    }
  }
  if ('template' in node && node.template) {
    if (!viewNodePassesPreviewQualityGate(node.template)) {
      return false;
    }
  }
  return true;
}

export function viewPassesPreviewQualityGate(view: ViewDefinition): boolean {
  if (!isPlausibleViewIdForPreview(view.viewId)) {
    return false;
  }
  for (const node of view.nodes) {
    if (!viewNodePassesPreviewQualityGate(node)) {
      return false;
    }
  }
  return true;
}
