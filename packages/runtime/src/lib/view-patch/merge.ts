import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';
import { deepEqual } from './deep-equal.js';
import {
  isChildContainerNode,
  isCollectionNode,
  stripCollectionTemplate,
  stripStructuralChildren,
} from './shared.js';

function findReusableNode(
  previousNodes: ViewNode[],
  nextNode: ViewNode,
  nextIndex: number,
  usedIndexes: Set<number>
): ViewNode | undefined {
  const indexedNode = previousNodes[nextIndex];
  if (
    indexedNode &&
    !usedIndexes.has(nextIndex) &&
    indexedNode.id === nextNode.id &&
    indexedNode.type === nextNode.type
  ) {
    usedIndexes.add(nextIndex);
    return indexedNode;
  }

  for (let index = 0; index < previousNodes.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }

    const candidate = previousNodes[index];
    if (candidate.id === nextNode.id && candidate.type === nextNode.type) {
      usedIndexes.add(index);
      return candidate;
    }
  }

  return undefined;
}

function mergeNodeList(
  previousNodes: ViewNode[],
  nextNodes: ViewNode[]
): ViewNode[] {
  const usedIndexes = new Set<number>();
  let changed = previousNodes.length !== nextNodes.length;

  const mergedNodes = nextNodes.map((nextNode, nextIndex) => {
    const previousNode = findReusableNode(
      previousNodes,
      nextNode,
      nextIndex,
      usedIndexes
    );

    if (!previousNode) {
      changed = true;
      return nextNode;
    }

    const mergedNode = patchViewNode(previousNode, nextNode);
    if (mergedNode !== previousNodes[nextIndex]) {
      changed = true;
    }

    return mergedNode;
  });

  return changed ? mergedNodes : previousNodes;
}

export function patchViewNode(
  previousNode: ViewNode | null | undefined,
  nextNode: ViewNode
): ViewNode {
  if (!previousNode) {
    return nextNode;
  }

  if (previousNode.id !== nextNode.id || previousNode.type !== nextNode.type) {
    return nextNode;
  }

  if (isChildContainerNode(previousNode) && isChildContainerNode(nextNode)) {
    const mergedChildren = mergeNodeList(
      previousNode.children,
      nextNode.children
    );
    if (
      mergedChildren === previousNode.children &&
      deepEqual(
        stripStructuralChildren(previousNode),
        stripStructuralChildren(nextNode)
      )
    ) {
      return previousNode;
    }

    return {
      ...nextNode,
      children: mergedChildren,
    };
  }

  if (isCollectionNode(previousNode) && isCollectionNode(nextNode)) {
    const mergedTemplate = patchViewNode(
      previousNode.template,
      nextNode.template
    );
    if (
      mergedTemplate === previousNode.template &&
      deepEqual(
        stripCollectionTemplate(previousNode),
        stripCollectionTemplate(nextNode)
      )
    ) {
      return previousNode;
    }

    return {
      ...nextNode,
      template: mergedTemplate,
    };
  }

  return deepEqual(previousNode, nextNode) ? previousNode : nextNode;
}

export function patchViewDefinition(
  previousView: ViewDefinition | null | undefined,
  nextView: ViewDefinition
): ViewDefinition {
  if (!previousView) {
    return nextView;
  }

  const mergedNodes = mergeNodeList(previousView.nodes, nextView.nodes);
  if (
    previousView.viewId === nextView.viewId &&
    previousView.version === nextView.version &&
    mergedNodes === previousView.nodes
  ) {
    return previousView;
  }

  return {
    ...nextView,
    nodes: mergedNodes,
  };
}
