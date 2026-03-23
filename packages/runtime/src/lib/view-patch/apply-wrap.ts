import type { ViewNode } from '@continuum-dev/contract';
import type { ContinuumViewPatchOperation } from './types.js';
import {
  type NodeListPatchResult,
  replaceCollectionTemplate,
  replaceStructuralChildren,
} from './apply-shared.js';
import { isChildContainerNode, isCollectionNode } from './shared.js';

function buildWrapperNode(
  wrapper: ViewNode,
  children: ViewNode[]
): ViewNode | null {
  if (
    wrapper.type !== 'group' &&
    wrapper.type !== 'row' &&
    wrapper.type !== 'grid'
  ) {
    return null;
  }

  return {
    ...wrapper,
    children,
  } as ViewNode;
}

function wrapNodeChildren(
  node: ViewNode,
  operation: Extract<ContinuumViewPatchOperation, { op: 'wrap-nodes' }>
): { node: ViewNode; applied: boolean } {
  if (isChildContainerNode(node)) {
    const childResult = wrapNodesInList(node.children, operation, node.id);
    if (childResult.applied) {
      return {
        node: replaceStructuralChildren(node, childResult.nodes),
        applied: true,
      };
    }
  }

  if (isCollectionNode(node)) {
    const templateResult = wrapNodesInList([node.template], operation, node.id);
    if (templateResult.applied) {
      const nextTemplate = templateResult.nodes[0] ?? node.template;
      return {
        node: replaceCollectionTemplate(node, nextTemplate),
        applied: true,
      };
    }
  }

  return {
    node,
    applied: false,
  };
}

export function wrapNodesInList(
  nodes: ViewNode[],
  operation: Extract<ContinuumViewPatchOperation, { op: 'wrap-nodes' }>,
  parentId: string | null
): NodeListPatchResult {
  if (operation.parentId === parentId) {
    const indexes = operation.nodeIds.map((nodeId) =>
      nodes.findIndex((candidate) => candidate.id === nodeId)
    );
    if (indexes.some((index) => index < 0)) {
      return {
        nodes,
        applied: false,
      };
    }

    const sortedIndexes = [...indexes].sort((left, right) => left - right);
    const firstIndex = sortedIndexes[0];
    if (firstIndex == null) {
      return {
        nodes,
        applied: false,
      };
    }

    const selectedNodes: ViewNode[] = [];
    for (const index of indexes) {
      const selectedNode = nodes[index];
      if (!selectedNode) {
        return {
          nodes,
          applied: false,
        };
      }
      selectedNodes.push(selectedNode);
    }

    const wrapperNode = buildWrapperNode(operation.wrapper, selectedNodes);
    if (!wrapperNode) {
      return {
        nodes,
        applied: false,
      };
    }

    const selectedIndexSet = new Set(indexes);
    const nextNodes = nodes.filter((_, index) => !selectedIndexSet.has(index));
    nextNodes.splice(firstIndex, 0, wrapperNode);
    return {
      nodes: nextNodes,
      applied: true,
    };
  }

  let applied = false;
  let changed = false;
  const nextNodes = nodes.map((node) => {
    const nodeResult = wrapNodeChildren(node, operation);
    if (!nodeResult.applied) {
      return node;
    }

    applied = true;
    changed = changed || nodeResult.node !== node;
    return nodeResult.node;
  });

  return {
    nodes: changed ? nextNodes : nodes,
    applied,
  };
}
