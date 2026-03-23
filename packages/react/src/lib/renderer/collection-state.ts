import type {
  CollectionNode,
  CollectionNodeState,
  NodeValue,
  ViewNode,
} from '@continuum-dev/core';
import { getChildNodes } from '@continuum-dev/core';
import { toCanonicalId } from './paths.js';

export function deepCloneValues(
  values: Record<string, NodeValue>
): Record<string, NodeValue> {
  return structuredClone(values);
}

export function normalizeCollectionNodeValue(
  value: NodeValue | undefined
): NodeValue<CollectionNodeState> {
  const normalizeState = (state: unknown): CollectionNodeState => {
    const items = (state as CollectionNodeState | undefined)?.items;
    if (!Array.isArray(items)) {
      return { items: [] };
    }
    return {
      items: items.map((item) => ({
        values:
          item &&
          typeof item === 'object' &&
          item.values &&
          typeof item.values === 'object'
            ? { ...item.values }
            : {},
      })),
    };
  };

  const metadata = value
    ? {
        ...(value.isDirty !== undefined ? { isDirty: value.isDirty } : {}),
        ...(value.isSticky !== undefined ? { isSticky: value.isSticky } : {}),
        ...(value.isValid !== undefined ? { isValid: value.isValid } : {}),
      }
    : {};

  const normalizedValue = normalizeState(
    (value as NodeValue<CollectionNodeState> | undefined)?.value
  );
  const rawSuggestion = (value as NodeValue<CollectionNodeState> | undefined)
    ?.suggestion;

  return {
    ...metadata,
    value: normalizedValue,
    ...(rawSuggestion !== undefined
      ? { suggestion: normalizeState(rawSuggestion) }
      : {}),
  } as NodeValue<CollectionNodeState>;
}

export function mergeCollectionItemSuggestion(
  baseValue: NodeValue | undefined,
  collectionSuggestion: CollectionNodeState | undefined,
  itemIndex: number,
  relativeId: string
): NodeValue | undefined {
  const suggestedNodeValue = collectionSuggestion?.items?.[itemIndex]?.values?.[
    relativeId
  ] as NodeValue | undefined;
  if (!suggestedNodeValue) {
    return baseValue;
  }

  const merged: NodeValue = baseValue
    ? { ...baseValue }
    : { value: suggestedNodeValue.value };

  if (merged.suggestion === undefined) {
    merged.suggestion = suggestedNodeValue.value;
  }

  return merged;
}

export function clearCollectionItemSuggestion(
  collectionSuggestion: CollectionNodeState | undefined,
  itemIndex: number,
  relativeId: string
): CollectionNodeState | undefined {
  if (!collectionSuggestion) {
    return undefined;
  }

  const items = collectionSuggestion.items.map((item) => ({
    values: deepCloneValues(item.values),
  }));

  if (itemIndex < items.length) {
    delete items[itemIndex].values[relativeId];
  }

  const hasAnySuggestion = items.some(
    (item) => Object.keys(item.values).length > 0
  );

  if (!hasAnySuggestion) {
    return undefined;
  }

  return { items };
}

export function normalizeMinItems(value: number | undefined): number {
  if (value === undefined || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export function normalizeMaxItems(
  value: number | undefined
): number | undefined {
  if (value === undefined || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

export function createInitialCollectionState(
  node: CollectionNode
): CollectionNodeState {
  const minItems = normalizeMinItems(node.minItems);
  return {
    items: Array.from({ length: minItems }, () => ({
      values: collectTemplateDefaults(node.template),
    })),
  };
}

export function collectTemplateDefaults(
  node: ViewNode,
  parentPath = ''
): Record<string, NodeValue> {
  const nodeId = toCanonicalId(node.id, parentPath);
  if (node.type === 'collection') {
    return {
      [nodeId]: {
        value: createInitialCollectionState(node),
      } as NodeValue<CollectionNodeState>,
    };
  }
  const values: Record<string, NodeValue> = {};
  if ('defaultValue' in node && node.defaultValue !== undefined) {
    values[nodeId] = { value: node.defaultValue };
  }
  const children = getChildNodes(node);
  for (const child of children) {
    Object.assign(values, collectTemplateDefaults(child, nodeId));
  }
  return values;
}
