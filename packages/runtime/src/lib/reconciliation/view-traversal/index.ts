import type { ViewNode } from '@continuum-dev/contract';
import { traverseViewNodesCore } from './traversal-core.js';
import type {
  TraverseViewInput,
  TraverseViewResult,
} from './types.js';

export type {
  TraverseViewInput,
  TraverseViewResult,
  TraversedViewNode,
} from './types.js';

export function traverseViewNodes(input: TraverseViewInput): TraverseViewResult;
export function traverseViewNodes(
  nodes: ViewNode[],
  maxDepth?: number
): TraverseViewResult;
export function traverseViewNodes(
  inputOrNodes: TraverseViewInput | ViewNode[],
  maxDepth?: number
): TraverseViewResult {
  return traverseViewNodesCore(normalizeTraverseInput(inputOrNodes, maxDepth));
}

function normalizeTraverseInput(
  inputOrNodes: TraverseViewInput | ViewNode[],
  maxDepth?: number
): TraverseViewInput {
  if (Array.isArray(inputOrNodes)) {
    return {
      nodes: inputOrNodes,
      maxDepth,
    };
  }

  return inputOrNodes;
}
