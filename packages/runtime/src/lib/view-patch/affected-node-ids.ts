import type { ViewNode } from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
import type { ContinuumViewPatch } from './types.js';

function collectNodeIds(node: ViewNode, ids: Set<string>): void {
  ids.add(node.id);
  const children = getChildNodes(node) ?? [];
  for (const child of children) {
    collectNodeIds(child, ids);
  }
}

export function collectContinuumViewPatchAffectedNodeIds(
  patch: ContinuumViewPatch
): string[] {
  const ids = new Set<string>();

  for (const operation of patch.operations) {
    switch (operation.op) {
      case 'insert-node':
        if (operation.parentId) {
          ids.add(operation.parentId);
        }
        collectNodeIds(operation.node, ids);
        break;
      case 'move-node':
        ids.add(operation.nodeId);
        if (operation.parentId) {
          ids.add(operation.parentId);
        }
        break;
      case 'wrap-nodes':
        if (operation.parentId) {
          ids.add(operation.parentId);
        }
        for (const nodeId of operation.nodeIds) {
          ids.add(nodeId);
        }
        collectNodeIds(operation.wrapper, ids);
        break;
      case 'replace-node':
        ids.add(operation.nodeId);
        collectNodeIds(operation.node, ids);
        break;
      case 'remove-node':
        ids.add(operation.nodeId);
        break;
    }
  }

  return [...ids];
}
