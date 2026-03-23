import type { ViewDefinition } from '@continuum-dev/contract';
import type { ContinuumViewPatch } from './types.js';
import { applyMoveNode, applyOperationToNodeList } from './apply-structural.js';
import { wrapNodesInList } from './apply-wrap.js';
import { patchViewDefinition } from './merge.js';

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
