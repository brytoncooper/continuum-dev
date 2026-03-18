import type { CollectionNode, ViewNode } from '@continuum-dev/contract';
import type { ContinuumViewPatchPosition } from './types.js';
import type { ChildContainerNode } from './shared.js';

export interface NodeListPatchResult {
  nodes: ViewNode[];
  applied: boolean;
}

export interface RemoveNodeResult {
  nodes: ViewNode[];
  removedNode: ViewNode | null;
  applied: boolean;
}

function clampIndex(index: number, length: number): number {
  if (Number.isNaN(index)) {
    return length;
  }

  return Math.max(0, Math.min(length, index));
}

export function insertNodeIntoList(
  nodes: ViewNode[],
  node: ViewNode,
  position?: ContinuumViewPatchPosition
): ViewNode[] {
  let insertIndex = nodes.length;

  if (position?.beforeId) {
    const beforeIndex = nodes.findIndex(
      (candidate) => candidate.id === position.beforeId
    );
    if (beforeIndex >= 0) {
      insertIndex = beforeIndex;
    }
  } else if (position?.afterId) {
    const afterIndex = nodes.findIndex(
      (candidate) => candidate.id === position.afterId
    );
    if (afterIndex >= 0) {
      insertIndex = afterIndex + 1;
    }
  } else if (typeof position?.index === 'number') {
    insertIndex = clampIndex(position.index, nodes.length);
  }

  return [
    ...nodes.slice(0, insertIndex),
    node,
    ...nodes.slice(insertIndex),
  ];
}

export function replaceStructuralChildren(
  node: ChildContainerNode,
  children: ViewNode[]
): ViewNode {
  return children === node.children
    ? node
    : {
        ...node,
        children,
      };
}

export function replaceCollectionTemplate(
  node: CollectionNode,
  template: ViewNode
): ViewNode {
  return template === node.template
    ? node
    : {
        ...node,
        template,
      };
}
