import type { DataSnapshot } from '@continuum-dev/contract';
import { findNewNodeByPriorNode } from './matching.js';
import type { ReconciliationContext } from './types.js';

export function buildPriorValueLookupByIdAndKey(
  priorData: DataSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown> {
  const lookup = new Map<string, unknown>();

  for (const [priorId, priorValue] of Object.entries(priorData.values)) {
    if (ctx.newById.has(priorId)) {
      lookup.set(priorId, priorValue);
    }

    const priorNode = ctx.priorById.get(priorId);
    if (!priorNode) {
      continue;
    }

    const newNode = findNewNodeByPriorNode(ctx, priorNode);
    if (!newNode) {
      continue;
    }

    const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
    lookup.set(newNodeId, priorValue);
  }

  return lookup;
}

export function resolvePriorSnapshotId(
  ctx: ReconciliationContext,
  priorId: string
): string | null {
  return ctx.priorById.has(priorId) ? priorId : null;
}
