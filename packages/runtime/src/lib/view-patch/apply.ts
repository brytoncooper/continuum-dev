import type { ViewDefinition } from '@continuum-dev/contract';
import type { ContinuumViewPatch } from './types.js';
import { applyMoveNode, applyOperationToNodeList } from './apply-structural.js';
import { wrapNodesInList } from './apply-wrap.js';
import { patchViewDefinition } from './merge.js';

function resolveUniqueNodeIdBySemanticKey(
  nodes: ViewDefinition['nodes'],
  semanticKey: string
): string | null {
  const matches: string[] = [];

  const walk = (items: ViewDefinition['nodes']) => {
    for (const node of items) {
      if (node.semanticKey === semanticKey) {
        matches.push(node.id);
      }

      if (
        (node.type === 'group' || node.type === 'row' || node.type === 'grid') &&
        Array.isArray(node.children)
      ) {
        walk(node.children);
      } else if (node.type === 'collection' && node.template) {
        walk([node.template]);
      }
    }
  };

  walk(nodes);
  return matches.length === 1 ? matches[0]! : null;
}

function resolvePatchOperationSelectors(
  nodes: ViewDefinition['nodes'],
  operation: ContinuumViewPatch['operations'][number]
): ContinuumViewPatch['operations'][number] {
  const resolveParentId = (
    parentId: string | null | undefined,
    parentSemanticKey: string | null | undefined
  ): string | null | undefined => {
    if (parentId !== undefined) {
      return parentId;
    }
    if (typeof parentSemanticKey !== 'string') {
      return parentId;
    }
    return resolveUniqueNodeIdBySemanticKey(nodes, parentSemanticKey) ?? undefined;
  };

  if (operation.op === 'insert-node') {
    return {
      ...operation,
      parentId: resolveParentId(
        operation.parentId,
        operation.parentSemanticKey
      ),
    };
  }

  if (operation.op === 'wrap-nodes') {
    return {
      ...operation,
      parentId: resolveParentId(
        operation.parentId,
        operation.parentSemanticKey
      ),
    };
  }

  if (operation.op === 'move-node') {
    return {
      ...operation,
      ...(operation.nodeId
        ? {}
        : typeof operation.semanticKey === 'string'
        ? {
            nodeId:
              resolveUniqueNodeIdBySemanticKey(nodes, operation.semanticKey) ??
              undefined,
          }
        : {}),
      parentId: resolveParentId(
        operation.parentId,
        operation.parentSemanticKey
      ),
    };
  }

  if (
    operation.op === 'replace-node' ||
    operation.op === 'remove-node' ||
    operation.op === 'append-content'
  ) {
    return {
      ...operation,
      ...(operation.nodeId
        ? {}
        : typeof operation.semanticKey === 'string'
        ? {
            nodeId:
              resolveUniqueNodeIdBySemanticKey(nodes, operation.semanticKey) ??
              undefined,
          }
        : {}),
    };
  }

  return operation;
}

export function applyContinuumViewPatch(
  currentView: ViewDefinition,
  patch: ContinuumViewPatch
): ViewDefinition {
  let nextNodes = currentView.nodes;

  for (const operation of patch.operations) {
    const resolvedOperation = resolvePatchOperationSelectors(nextNodes, operation);
    const result =
      resolvedOperation.op === 'move-node'
        ? applyMoveNode(nextNodes, resolvedOperation)
        : resolvedOperation.op === 'wrap-nodes'
        ? wrapNodesInList(nextNodes, resolvedOperation, null)
        : applyOperationToNodeList(nextNodes, resolvedOperation);
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
