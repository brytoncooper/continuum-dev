import type {
  CollectionNode,
  CollectionNodeState,
  NodeValue,
} from '@continuum-dev/contract';
import { createInitialCollectionValue } from '../../reconciliation/collection-resolver/index.js';

export function cloneNodeValue(value: NodeValue): NodeValue {
  return structuredClone(value);
}

export function normalizeCollectionState(
  value: NodeValue | undefined,
  collectionNode: CollectionNode
): NodeValue<CollectionNodeState> {
  if (!value || typeof value !== 'object' || !('value' in value)) {
    return createInitialCollectionValue(collectionNode);
  }

  const items = (
    (value as NodeValue<CollectionNodeState>).value?.items ?? []
  ).map((item) => ({ values: { ...(item?.values ?? {}) } }));

  return {
    ...(value as NodeValue<CollectionNodeState>),
    value: { items },
  };
}
