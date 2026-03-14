import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';

interface TemplatePathMap {
  keyToPath: Map<string, string>;
  pathToKey: Map<string, string>;
  allPaths: Set<string>;
}

export function buildTemplatePathMap(
  node: ViewNode,
  parentPath = ''
): TemplatePathMap {
  const keyToPath = new Map<string, string>();
  const pathToKey = new Map<string, string>();
  const allPaths = new Set<string>();

  function walk(current: ViewNode, parent: string): void {
    const nodePath = parent.length > 0 ? `${parent}/${current.id}` : current.id;
    allPaths.add(nodePath);

    if (current.key) {
      keyToPath.set(current.key, nodePath);
      pathToKey.set(nodePath, current.key);
    }

    for (const child of getChildNodes(current)) {
      walk(child, nodePath);
    }
  }

  walk(node, parentPath);
  return { keyToPath, pathToKey, allPaths };
}

export function remapCollectionItemPaths(
  oldValues: Record<string, NodeValue>,
  priorMap: Pick<TemplatePathMap, 'pathToKey' | 'allPaths'>,
  newMap: Pick<TemplatePathMap, 'keyToPath' | 'allPaths'>
): Record<string, NodeValue> {
  const remapped: Record<string, NodeValue> = {};
  let hasChanges = false;

  for (const [oldPath, value] of Object.entries(oldValues)) {
    const templateKey = priorMap.pathToKey.get(oldPath);
    const newPath = templateKey ? newMap.keyToPath.get(templateKey) : undefined;

    if (newPath && newPath !== oldPath) {
      remapped[newPath] = value;
      hasChanges = true;
      continue;
    }

    remapped[oldPath] = value;
  }

  return hasChanges ? remapped : oldValues;
}

export function needsPathRemapping(
  priorMap: Pick<TemplatePathMap, 'allPaths'>,
  newMap: Pick<TemplatePathMap, 'allPaths'>
): boolean {
  if (priorMap.allPaths.size !== newMap.allPaths.size) {
    return true;
  }

  for (const path of priorMap.allPaths) {
    if (!newMap.allPaths.has(path)) {
      return true;
    }
  }

  return false;
}
