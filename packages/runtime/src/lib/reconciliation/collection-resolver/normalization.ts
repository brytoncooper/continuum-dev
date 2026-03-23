import type {
  CollectionNode,
  CollectionNodeState,
  NodeValue,
  ViewNode,
} from '@continuum-dev/contract';
import { createInitialCollectionValue } from './defaults.js';

const CONTAINER_TYPES = new Set(['row', 'grid', 'group']);

export function areCompatibleContainerTypes(a: string, b: string): boolean {
  return CONTAINER_TYPES.has(a) && CONTAINER_TYPES.has(b);
}

export function normalizeCollectionValue(
  node: CollectionNode,
  value: unknown
): NodeValue<CollectionNodeState> {
  if (
    !value ||
    typeof value !== 'object' ||
    !('value' in (value as Record<string, unknown>))
  ) {
    return createInitialCollectionValue(node);
  }

  const nodeValue = value as NodeValue;
  const normalizeState = (state: unknown): CollectionNodeState => {
    const typedState = state as
      | { items?: Array<{ values?: Record<string, NodeValue> }> }
      | undefined;
    const items = Array.isArray(typedState?.items)
      ? typedState.items.map((item) => ({
          values: (item?.values ?? {}) as Record<string, NodeValue>,
        }))
      : [];
    return { items };
  };

  return {
    value: normalizeState(nodeValue.value),
    ...(nodeValue.suggestion !== undefined
      ? { suggestion: normalizeState(nodeValue.suggestion) }
      : {}),
    ...(nodeValue.isDirty !== undefined ? { isDirty: nodeValue.isDirty } : {}),
    ...(nodeValue.isSticky !== undefined
      ? { isSticky: nodeValue.isSticky }
      : {}),
    ...(nodeValue.isValid !== undefined ? { isValid: nodeValue.isValid } : {}),
  };
}

export function hasTemplateHashChanged(
  priorTemplate: ViewNode,
  newTemplate: ViewNode
): boolean {
  return !!(
    priorTemplate.hash &&
    newTemplate.hash &&
    priorTemplate.hash !== newTemplate.hash
  );
}

export function hasProtectedItems(value: unknown): boolean {
  const items = (
    value as { items?: Array<{ values?: Record<string, NodeValue> }> }
  )?.items;
  if (!Array.isArray(items)) {
    return false;
  }

  return items.some((item) =>
    Object.values(item.values ?? {}).some(
      (nodeValue) => nodeValue.isDirty === true || nodeValue.isSticky === true
    )
  );
}
