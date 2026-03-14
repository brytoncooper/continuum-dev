import type {
  CollectionNode,
  CollectionNodeState,
  DataSnapshot,
  NodeValue,
  ViewNode,
} from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
import { createInitialCollectionValue } from '../reconciliation/collection-resolver/index.js';

export function updateCollectionTargetValue(
  currentValue: NodeValue | undefined,
  collectionNode: CollectionNode,
  pathChain: string[],
  sourceValue: NodeValue
): NodeValue<CollectionNodeState> {
  const normalized = normalizeCollectionState(currentValue, collectionNode);

  return {
    ...normalized,
    value: {
      items: normalized.value.items.map((item) => ({
        values: writePathChain(
          item.values ?? {},
          collectionNode.template,
          pathChain,
          sourceValue
        ),
      })),
    },
  };
}

export function readCollectionFirstItemValue(
  priorData: DataSnapshot,
  outerCollectionId: string,
  outerCollectionNode: CollectionNode,
  pathChain: string[]
): NodeValue | undefined {
  const rootValue = priorData.values[outerCollectionId] as NodeValue | undefined;
  const items = (rootValue?.value as CollectionNodeState | undefined)?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return undefined;
  }

  return readPathFromItem(
    items[0].values ?? {},
    outerCollectionNode.template,
    pathChain
  );
}

export function cloneNodeValue(value: NodeValue): NodeValue {
  return structuredClone(value);
}

function writePathChain(
  values: Record<string, NodeValue>,
  template: ViewNode,
  pathChain: string[],
  sourceValue: NodeValue
): Record<string, NodeValue> {
  if (pathChain.length === 0) {
    return values;
  }

  if (pathChain.length === 1) {
    return {
      ...values,
      [pathChain[0]]: cloneNodeValue(sourceValue),
    };
  }

  const nestedPath = pathChain[0];
  const nestedNode = findNodeByPath(template, nestedPath);
  if (!nestedNode || nestedNode.type !== 'collection') {
    return values;
  }

  const normalizedNested = normalizeCollectionState(values[nestedPath], nestedNode);
  return {
    ...values,
    [nestedPath]: {
      ...normalizedNested,
      value: {
        items: normalizedNested.value.items.map((item) => ({
          values: writePathChain(
            item.values ?? {},
            nestedNode.template,
            pathChain.slice(1),
            sourceValue
          ),
        })),
      },
    },
  };
}

function readPathFromItem(
  values: Record<string, NodeValue>,
  template: ViewNode,
  pathChain: string[]
): NodeValue | undefined {
  if (pathChain.length === 0) {
    return undefined;
  }

  if (pathChain.length === 1) {
    return values[pathChain[0]];
  }

  const nestedPath = pathChain[0];
  const nestedNode = findNodeByPath(template, nestedPath);
  if (!nestedNode || nestedNode.type !== 'collection') {
    return undefined;
  }

  const nestedValue = values[nestedPath] as
    | NodeValue<CollectionNodeState>
    | undefined;
  const nestedItems = nestedValue?.value?.items;
  if (!Array.isArray(nestedItems) || nestedItems.length === 0) {
    return undefined;
  }

  return readPathFromItem(
    nestedItems[0].values ?? {},
    nestedNode.template,
    pathChain.slice(1)
  );
}

function normalizeCollectionState(
  value: NodeValue | undefined,
  collectionNode: CollectionNode
): NodeValue<CollectionNodeState> {
  if (!value || typeof value !== 'object' || !('value' in value)) {
    return createInitialCollectionValue(collectionNode);
  }

  const items = ((value as NodeValue<CollectionNodeState>).value?.items ?? []).map(
    (item) => ({ values: { ...(item?.values ?? {}) } })
  );

  return {
    ...(value as NodeValue<CollectionNodeState>),
    value: { items },
  };
}

function findNodeByPath(template: ViewNode, relativePath: string): ViewNode | null {
  const segments = relativePath.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments[0] !== template.id) {
    return null;
  }

  let current: ViewNode = template;
  for (const segment of segments.slice(1)) {
    const child = getChildNodes(current).find((node) => node.id === segment);
    if (!child) {
      return null;
    }
    current = child;
  }

  return current;
}
