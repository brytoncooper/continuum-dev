import type { DataSnapshot } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../context/index.js';
import type { NodeResolutionAccumulator } from '../types.js';
import { collectSemanticKeyLocations } from './semantic-key-locations.js';
import { applyCollectionToTopMoves } from './semantic-key-collection-to-top.js';
import { applyTopToCollectionMoves } from './semantic-key-top-to-collection.js';

export function applySemanticKeyMoves(
  ctx: ReconciliationContext,
  priorData: DataSnapshot,
  resolved: NodeResolutionAccumulator
): void {
  const priorLocations = collectSemanticKeyLocations(ctx.priorView?.nodes ?? []);
  const newLocations = collectSemanticKeyLocations(ctx.newView.nodes);

  applyTopToCollectionMoves(priorLocations, newLocations, priorData, ctx, resolved);
  applyCollectionToTopMoves(priorLocations, newLocations, priorData, ctx, resolved);
}
