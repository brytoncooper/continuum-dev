import type {
  CollectionNode,
  CollectionNodeState,
  DataSnapshot,
  NodeValue,
  ViewNode,
} from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
import {
  cloneNodeValue,
  normalizeCollectionState,
} from './collection-state-normalizer.js';

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
          sourceValue,
          normalizeCollectionState,
          cloneNodeValue
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

  return readPathFromFirstItem(
    items[0].values ?? {},
    outerCollectionNode.template,
    pathChain
  );
}

export function writePathChain(
  values: Record<string, NodeValue>,
  template: ViewNode,
  pathChain: string[],
  sourceValue: NodeValue,
  normalizeCollectionStateFn: (
    value: NodeValue | undefined,
    collectionNode: ViewNode & { type: 'collection' }
  ) => NodeValue<CollectionNodeState>,
  cloneNodeValueFn: (value: NodeValue) => NodeValue
): Record<string, NodeValue> {
  if (pathChain.length === 0) {
    return values;
  }

  if (pathChain.length === 1) {
    return {
      ...values,
      [pathChain[0]]: cloneNodeValueFn(sourceValue),
    };
  }

  const nestedPath = pathChain[0];
  const nestedNode = findNodeByPath(template, nestedPath);
  if (!nestedNode || nestedNode.type !== 'collection') {
    return values;
  }

  const normalizedNested = normalizeCollectionStateFn(values[nestedPath], nestedNode);
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
            sourceValue,
            normalizeCollectionStateFn,
            cloneNodeValueFn
          ),
        })),
      },
    },
  };
}

export function readPathFromFirstItem(
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

  return readPathFromFirstItem(
    nestedItems[0].values ?? {},
    nestedNode.template,
    pathChain.slice(1)
  );
}

export function findNodeByPath(
  template: ViewNode,
  relativePath: string
): ViewNode | null {
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
