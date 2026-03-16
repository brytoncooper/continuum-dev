import type {
  CollectionNode,
  GridNode,
  GroupNode,
  RowNode,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
import type {
  ContinuumViewPatch,
  ContinuumViewPatchOperation,
  ContinuumViewPatchPosition,
} from '@continuum-dev/protocol';

export type {
  ContinuumViewPatch,
  ContinuumViewPatchOperation,
  ContinuumViewPatchPosition,
} from '@continuum-dev/protocol';

type ChildContainerNode = GroupNode | RowNode | GridNode;

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return false;
    }

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false;
      }

      if (!deepEqual(left[key], right[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function isChildContainerNode(node: ViewNode): node is ChildContainerNode {
  return node.type === 'group' || node.type === 'row' || node.type === 'grid';
}

function isCollectionNode(node: ViewNode): node is CollectionNode {
  return node.type === 'collection';
}

function stripStructuralChildren(node: ChildContainerNode): Omit<ChildContainerNode, 'children'> {
  const { children: _children, ...rest } = node;
  return rest;
}

function stripCollectionTemplate(
  node: CollectionNode
): Omit<CollectionNode, 'template'> {
  const { template: _template, ...rest } = node;
  return rest;
}

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

function mergeNodeList(previousNodes: ViewNode[], nextNodes: ViewNode[]): ViewNode[] {
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

function clampIndex(index: number, length: number): number {
  if (Number.isNaN(index)) {
    return length;
  }

  return Math.max(0, Math.min(length, index));
}

function insertNodeIntoList(
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

interface NodeListPatchResult {
  nodes: ViewNode[];
  applied: boolean;
}

interface RemoveNodeResult {
  nodes: ViewNode[];
  removedNode: ViewNode | null;
  applied: boolean;
}

function applyOperationToNodeList(
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
        nextNodes.push({
          ...node,
          children: insertNodeIntoList(
            node.children,
            operation.node,
            operation.position
          ),
        });
        applied = true;
        changed = true;
        continue;
      }
    }

    if (isChildContainerNode(node)) {
      const childResult = applyOperationToNodeList(node.children, operation);
      if (childResult.applied) {
        nextNodes.push(
          childResult.nodes === node.children
            ? node
            : {
                ...node,
                children: childResult.nodes,
              }
        );
        applied = true;
        changed = changed || childResult.nodes !== node.children;
        continue;
      }
    }

    if (isCollectionNode(node)) {
      if (operation.op === 'remove-node' && node.template.id === operation.nodeId) {
        nextNodes.push(node);
        applied = true;
        continue;
      }

      if (operation.op === 'replace-node' && node.template.id === operation.nodeId) {
        nextNodes.push({
          ...node,
          template: operation.node,
        });
        applied = true;
        changed = true;
        continue;
      }

      const templateResult = applyOperationToNodeList(
        [node.template],
        operation
      );
      if (templateResult.applied) {
        const nextTemplate = templateResult.nodes[0] ?? node.template;
        nextNodes.push(
          nextTemplate === node.template
            ? node
            : {
                ...node,
                template: nextTemplate,
              }
        );
        applied = true;
        changed = changed || nextTemplate !== node.template;
        continue;
      }
    }

    nextNodes.push(node);
  }

  return {
    nodes: changed ? nextNodes : nodes,
    applied,
  };
}

function removeNodeFromList(
  nodes: ViewNode[],
  nodeId: string
): RemoveNodeResult {
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

    if (isChildContainerNode(node)) {
      const childResult = removeNodeFromList(node.children, nodeId);
      if (childResult.applied) {
        nextNodes.push(
          childResult.nodes === node.children
            ? node
            : {
                ...node,
                children: childResult.nodes,
              }
        );
        removedNode = childResult.removedNode;
        applied = true;
        changed = changed || childResult.nodes !== node.children;
        continue;
      }
    }

    if (isCollectionNode(node)) {
      if (!removedNode && node.template.id === nodeId) {
        removedNode = node.template;
        applied = true;
        continue;
      }

      const templateResult = removeNodeFromList([node.template], nodeId);
      if (templateResult.applied) {
        const nextTemplate = templateResult.nodes[0] ?? node.template;
        nextNodes.push(
          nextTemplate === node.template
            ? node
            : {
                ...node,
                template: nextTemplate,
              }
        );
        removedNode = templateResult.removedNode;
        applied = true;
        changed = changed || nextTemplate !== node.template;
        continue;
      }
    }

    nextNodes.push(node);
  }

  return {
    nodes: changed ? nextNodes : nodes,
    removedNode,
    applied,
  };
}

function applyMoveNode(
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

function buildWrapperNode(
  wrapper: ViewNode,
  children: ViewNode[]
): ViewNode | null {
  if (wrapper.type !== 'group' && wrapper.type !== 'row' && wrapper.type !== 'grid') {
    return null;
  }

  return {
    ...wrapper,
    children,
  } as ViewNode;
}

function wrapNodesInList(
  nodes: ViewNode[],
  operation: Extract<ContinuumViewPatchOperation, { op: 'wrap-nodes' }>,
  parentId: string | null
): NodeListPatchResult {
  if (operation.parentId === parentId) {
    const nodeIds = operation.nodeIds;
    const indexes = nodeIds.map((nodeId) =>
      nodes.findIndex((candidate) => candidate.id === nodeId)
    );
    if (indexes.some((index) => index < 0)) {
      return {
        nodes,
        applied: false,
      };
    }

    const sortedIndexes = [...indexes].sort((left, right) => left - right);
    const firstIndex = sortedIndexes[0]!;
    const selectedNodes = indexes.map((index) => nodes[index]!);
    const wrapperNode = buildWrapperNode(operation.wrapper, selectedNodes);
    if (!wrapperNode) {
      return {
        nodes,
        applied: false,
      };
    }

    const nextNodes = nodes.filter((_, index) => !indexes.includes(index));
    nextNodes.splice(firstIndex, 0, wrapperNode);
    return {
      nodes: nextNodes,
      applied: true,
    };
  }

  let applied = false;
  let changed = false;
  const nextNodes = nodes.map((node) => {
    if (node.id === operation.parentId && isChildContainerNode(node)) {
      const wrappedChildren = wrapNodesInList(
        node.children,
        operation,
        operation.parentId ?? null
      );
      if (!wrappedChildren.applied) {
        return node;
      }
      applied = true;
      changed = wrappedChildren.nodes !== node.children;
      return wrappedChildren.nodes === node.children
        ? node
        : {
            ...node,
            children: wrappedChildren.nodes,
          };
    }

    if (isChildContainerNode(node)) {
      const childResult = wrapNodesInList(
        node.children,
        operation,
        node.id
      );
      if (!childResult.applied) {
        return node;
      }
      applied = true;
      changed = changed || childResult.nodes !== node.children;
      return childResult.nodes === node.children
        ? node
        : {
            ...node,
            children: childResult.nodes,
          };
    }

    if (isCollectionNode(node)) {
      const templateResult = wrapNodesInList(
        [node.template],
        operation,
        node.id
      );
      if (!templateResult.applied) {
        return node;
      }
      const nextTemplate = templateResult.nodes[0] ?? node.template;
      applied = true;
      changed = changed || nextTemplate !== node.template;
      return nextTemplate === node.template
        ? node
        : {
            ...node,
            template: nextTemplate,
          };
    }

    return node;
  });

  return {
    nodes: changed ? nextNodes : nodes,
    applied,
  };
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
    const mergedChildren = mergeNodeList(previousNode.children, nextNode.children);
    if (
      mergedChildren === previousNode.children &&
      deepEqual(stripStructuralChildren(previousNode), stripStructuralChildren(nextNode))
    ) {
      return previousNode;
    }

    return {
      ...nextNode,
      children: mergedChildren,
    };
  }

  if (isCollectionNode(previousNode) && isCollectionNode(nextNode)) {
    const mergedTemplate = patchViewNode(previousNode.template, nextNode.template);
    if (
      mergedTemplate === previousNode.template &&
      deepEqual(stripCollectionTemplate(previousNode), stripCollectionTemplate(nextNode))
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

export function applyContinuumViewPatch(
  currentView: ViewDefinition,
  patch: ContinuumViewPatch
): ViewDefinition {
  let nextNodes = currentView.nodes;

  for (const operation of patch.operations) {
    const result =
      operation.op === 'move-node'
        ? applyMoveNode(nextNodes, operation)
        : operation.op === 'wrap-nodes'
          ? wrapNodesInList(nextNodes, operation, null)
          : applyOperationToNodeList(nextNodes, operation);
    if (result.applied) {
      nextNodes = result.nodes;
    }
  }

  return patchViewDefinition(currentView, {
    ...currentView,
    ...(patch.viewId ? { viewId: patch.viewId } : {}),
    ...(patch.version ? { version: patch.version } : {}),
    nodes: nextNodes,
  });
}
