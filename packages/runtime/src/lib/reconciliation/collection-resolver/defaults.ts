import type {
  CollectionNode,
  CollectionNodeState,
  NodeValue,
  ViewNode,
} from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
import { buildTemplatePathMap } from './template-paths.js';

export function resolveCollectionDefaultValues(
  node: CollectionNode
): NodeValue<CollectionNodeState> {
  if (!node.defaultValues || !Array.isArray(node.defaultValues)) {
    return createInitialCollectionValue(node);
  }

  const { keyToPath } = buildTemplatePathMap(node.template);
  const templateDefaults = collectTemplateDefaults(node.template);
  const items = node.defaultValues.map((defaultItem) => {
    const itemValues: Record<string, NodeValue> = {};

    for (const [key, value] of Object.entries(defaultItem)) {
      itemValues[keyToPath.get(key) ?? key] = { value };
    }

    for (const [path, defaultValue] of Object.entries(templateDefaults)) {
      if (!(path in itemValues)) {
        itemValues[path] = defaultValue;
      }
    }

    return { values: itemValues };
  });

  return { value: { items } };
}

export function createInitialCollectionValue(
  node: CollectionNode
): NodeValue<CollectionNodeState> {
  if (node.defaultValues && Array.isArray(node.defaultValues)) {
    return resolveCollectionDefaultValues(node);
  }

  const items = Array.from({ length: normalizeMinItems(node.minItems) }, () => ({
    values: collectTemplateDefaults(node.template),
  }));

  return { value: { items } };
}

export function collectTemplateDefaults(
  node: ViewNode,
  parentPath = ''
): Record<string, NodeValue> {
  const nodeId = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
  if (node.type === 'collection') {
    return { [nodeId]: createInitialCollectionValue(node) };
  }

  const values: Record<string, NodeValue> = {};
  if ('defaultValue' in node && node.defaultValue !== undefined) {
    values[nodeId] = { value: node.defaultValue };
  }

  for (const child of getChildNodes(node)) {
    Object.assign(values, collectTemplateDefaults(child, nodeId));
  }

  return values;
}

export function normalizeMinItems(value: number | undefined): number {
  if (value === undefined || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export function normalizeMaxItems(value: number | undefined): number | undefined {
  if (value === undefined || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}
