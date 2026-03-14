import type { DataSnapshot } from '@continuum-dev/contract';
import {
  determineNodeMatchStrategy,
  findPriorNode,
  type ReconciliationContext,
} from '../../context/index.js';
import type {
  NodeResolutionAccumulator,
  ReconciliationOptions,
} from '../../types.js';
import { resolveNode } from './matched-node.js';

export { detectRemovedNodes } from './removed-nodes.js';

export function resolveAllNodes(
  ctx: ReconciliationContext,
  priorValues: Map<string, unknown>,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): NodeResolutionAccumulator {
  const accumulator: NodeResolutionAccumulator = {
    values: {},
    valueLineage: {},
    detachedValues: {},
    restoredDetachedKeys: new Set<string>(),
    diffs: [],
    resolutions: [],
    issues: [],
  };

  for (const [newId, newNode] of ctx.newById) {
    const priorNode = findPriorNode(ctx, newNode);
    const priorNodeId = priorNode
      ? ctx.priorNodeIds.get(priorNode) ?? priorNode.id
      : null;
    const matchedBy = determineNodeMatchStrategy(ctx, newNode, priorNode);
    const carriedPriorValue = priorValues.get(newId);
    const priorValue =
      matchedBy === 'id'
        ? carriedPriorValue ??
          (priorNodeId ? priorData.values[priorNodeId] : undefined)
        : carriedPriorValue;

    resolveNode(
      accumulator,
      ctx,
      newId,
      newNode,
      priorNode,
      priorNodeId,
      matchedBy,
      priorValue,
      priorData,
      now,
      options
    );
  }

  return accumulator;
}
