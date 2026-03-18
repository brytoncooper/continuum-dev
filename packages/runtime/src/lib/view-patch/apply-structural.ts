import type { ViewNode } from '@continuum-dev/contract';
import type { ContinuumViewPatchOperation } from './types.js';
import {
  insertNodeIntoList,
  type NodeListPatchResult,
  type RemoveNodeResult,
  replaceCollectionTemplate,
  replaceStructuralChildren,
} from './apply-shared.js';
import { isChildContainerNode, isCollectionNode } from './shared.js';

interface NodePatchResult {
  node: ViewNode;
  applied: boolean;
}

interface NodeRemovalResult {
  node: ViewNode;
  removedNode: ViewNode | null;
  applied: boolean;
}

function applyOperationToNode(
  node: ViewNode,
  operation: ContinuumViewPatchOperation
): NodePatchResult {
  if (isChildContainerNode(node)) {
    const childResult = applyOperationToNodeList(node.children, operation);
    if (childResult.applied) {
      return {
        node: replaceStructuralChildren(node, childResult.nodes),
        applied: true,
      };
    }
  }

  if (isCollectionNode(node)) {
    if (operation.op === 'remove-node' && node.template.id === operation.nodeId) {
      return {
        node,
        applied: true,
      };
    }

    if (operation.op === 'replace-node' && node.template.id === operation.nodeId) {
      return {
        node: replaceCollectionTemplate(node, operation.node),
        applied: true,
      };
    }

    const templateResult = applyOperationToNodeList([node.template], operation);
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

export function applyOperationToNodeList(
  nodes: ViewNode[],
  operation: ContinuumViewPatchOperation
): NodeListPatchResult {
  if (operation.op === 'insert-node' && operation.parentId == null) {
    return {
      nodes: insertNodeIntoList(nodes, operation.node, operation.position),
      applied: true,
    };
  }

  let applied = false;
  let changed = false;
  const nextNodes: ViewNode[] = [];

  for (const node of nodes) {
    if (operation.op === 'remove-node' && node.id === operation.nodeId) {
      applied = true;
      changed = true;
      continue;
    }

    if (operation.op === 'replace-node' && node.id === operation.nodeId) {
      nextNodes.push(operation.node);
      applied = true;
      changed = true;
      continue;
    }

    if (operation.op === 'insert-node' && operation.parentId === node.id) {
      if (isChildContainerNode(node)) {
        nextNodes.push(
          replaceStructuralChildren(
            node,
            insertNodeIntoList(node.children, operation.node, operation.position)
          )
        );
        applied = true;
        changed = true;
        continue;
      }
    }

    const nodeResult = applyOperationToNode(node, operation);
    if (nodeResult.applied) {
      nextNodes.push(nodeResult.node);
      applied = true;
      changed = changed || nodeResult.node !== node;
      continue;
    }

    nextNodes.push(node);
  }

  return {
    nodes: changed ? nextNodes : nodes,
    applied,
  };
}

function removeNodeFromTree(node: ViewNode, nodeId: string): NodeRemovalResult {
  if (isChildContainerNode(node)) {
    const childResult = removeNodeFromList(node.children, nodeId);
    if (childResult.applied) {
      return {
        node: replaceStructuralChildren(node, childResult.nodes),
        removedNode: childResult.removedNode,
        applied: true,
      };
    }
  }

  if (isCollectionNode(node)) {
    if (node.template.id === nodeId) {
      return {
        node,
        removedNode: null,
        applied: true,
      };
    }

    const templateResult = removeNodeFromList([node.template], nodeId);
    if (templateResult.applied) {
      const nextTemplate = templateResult.nodes[0] ?? node.template;
      return {
        node: replaceCollectionTemplate(node, nextTemplate),
        removedNode: templateResult.removedNode,
        applied: true,
      };
    }
  }

  return {
    node,
    removedNode: null,
    applied: false,
  };
}

function removeNodeFromList(nodes: ViewNode[], nodeId: string): RemoveNodeResult {
  let removedNode: ViewNode | null = null;
  let applied = false;
  let changed = false;
  const nextNodes: ViewNode[] = [];

  for (const node of nodes) {
    if (!removedNode && node.id === nodeId) {
      removedNode = node;
      applied = true;
      changed = true;
      continue;
    }

    const nodeResult = removeNodeFromTree(node, nodeId);
    if (nodeResult.applied) {
      nextNodes.push(nodeResult.node);
      removedNode = nodeResult.removedNode;
      applied = true;
      changed = changed || nodeResult.node !== node;
      continue;
    }

    nextNodes.push(node);
  }

  return {
    nodes: changed ? nextNodes : nodes,
    removedNode,
    applied,
  };
}

export function applyMoveNode(
  nodes: ViewNode[],
  operation: Extract<ContinuumViewPatchOperation, { op: 'move-node' }>
): NodeListPatchResult {
  const removed = removeNodeFromList(nodes, operation.nodeId);
  if (!removed.applied || !removed.removedNode) {
    return {
      nodes,
      applied: false,
    };
  }

  const inserted = applyOperationToNodeList(removed.nodes, {
    op: 'insert-node',
    parentId:
      typeof operation.parentId === 'string' ? operation.parentId : operation.parentId ?? null,
    position: operation.position,
    node: removed.removedNode,
  });

  if (!inserted.applied) {
    return {
      nodes,
      applied: false,
    };
  }

  return inserted;
}
