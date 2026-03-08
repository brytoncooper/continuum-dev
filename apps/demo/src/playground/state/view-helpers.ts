import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';

function childNodes(node: ViewNode): ViewNode[] {
  if ('children' in node && Array.isArray(node.children)) {
    return node.children as ViewNode[];
  }

  return [];
}

function scopedNodeId(nodeId: string, parentNodeId?: string): string {
  return parentNodeId ? `${parentNodeId}/${nodeId}` : nodeId;
}

function collectScopedNodeIds(
  nodes: ViewNode[],
  parentNodeId?: string
): string[] {
  return nodes.flatMap((node) => {
    const nodeId = scopedNodeId(node.id, parentNodeId);
    return [nodeId, ...collectScopedNodeIds(childNodes(node), nodeId)];
  });
}

function findScopedNodeId(
  nodes: ViewNode[],
  trackedKey: string,
  parentNodeId?: string
): string | null {
  for (const node of nodes) {
    const nodeId = scopedNodeId(node.id, parentNodeId);

    if ('key' in node && node.key === trackedKey) {
      return nodeId;
    }

    const nestedNodeId = findScopedNodeId(childNodes(node), trackedKey, nodeId);
    if (nestedNodeId) {
      return nestedNodeId;
    }
  }

  return null;
}

export function collectScopedNodeIdsFromView(view: ViewDefinition): string[] {
  return collectScopedNodeIds(view.nodes);
}

export function findScopedNodeIdByKey(
  view: ViewDefinition,
  trackedKey: string
): string | null {
  return findScopedNodeId(view.nodes, trackedKey);
}

export function findScopedNodeIdsByKey(
  view: ViewDefinition,
  trackedKeys: string[]
): Record<string, string | null> {
  return Object.fromEntries(
    trackedKeys.map((trackedKey) => [
      trackedKey,
      findScopedNodeIdByKey(view, trackedKey),
    ])
  ) as Record<string, string | null>;
}
