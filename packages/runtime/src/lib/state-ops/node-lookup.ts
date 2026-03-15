import type { ViewNode } from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
import type { RuntimeNodeLookupEntry } from './types.js';

export function collectNodesByCanonicalId(
  nodes: ViewNode[]
): Map<string, RuntimeNodeLookupEntry> {
  const byId = new Map<string, RuntimeNodeLookupEntry>();

  const walk = (
    items: ViewNode[],
    parentPath: string,
    parentNode: ViewNode | null
  ) => {
    for (const node of items) {
      const canonicalId =
        parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
      byId.set(canonicalId, { canonicalId, node, parentNode });

      const children = getChildNodes(node);
      if (children.length > 0) {
        walk(children, canonicalId, node);
      }
    }
  };

  walk(nodes, '', null);
  return byId;
}

export function collectCanonicalNodeIds(nodes: ViewNode[]): Set<string> {
  return new Set(collectNodesByCanonicalId(nodes).keys());
}

export function resolveNodeLookupEntry(
  nodes: ViewNode[],
  requestedId: string
): RuntimeNodeLookupEntry | null {
  const canonicalMap = collectNodesByCanonicalId(nodes);
  const direct = canonicalMap.get(requestedId);
  if (direct) {
    return direct;
  }

  const matches = [...canonicalMap.values()].filter(
    (entry) => entry.node.id === requestedId
  );

  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}
