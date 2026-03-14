import type { ViewDefinition } from '@continuum-dev/contract';
import { traverseViewNodes } from '../view-traversal.js';

export function computeViewHash(view: ViewDefinition): string | undefined {
  const traversal = traverseViewNodes(view.nodes);
  let hasHash = false;
  const descriptors = traversal.visited.map((entry) => {
    if (entry.node.hash) {
      hasHash = true;
    }

    return {
      positionPath: entry.positionPath,
      nodeId: entry.nodeId,
      type: entry.node.type,
      hash: entry.node.hash ?? null,
    };
  });

  if (!hasHash) {
    return undefined;
  }

  descriptors.sort((left, right) =>
    left.positionPath.localeCompare(right.positionPath)
  );
  return JSON.stringify(descriptors);
}

export function generateSessionId(now: number): string {
  return `session_${now}`;
}
