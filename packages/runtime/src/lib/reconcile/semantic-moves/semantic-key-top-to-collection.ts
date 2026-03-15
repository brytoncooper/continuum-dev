import type { DataSnapshot } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../../context/index.js';
import type { NodeResolutionAccumulator } from '../../types.js';
import { migratedDiff } from '../../reconciliation/differ/index.js';
import { updateCollectionTargetValue } from '../collection-lens/collection-path-lens.js';
import { planTopToCollectionMoves } from './semantic-key-move-planner.js';
import type { SemanticKeyLocation } from './semantic-key-locations.js';

export function applyTopToCollectionMoves(
  priorLocations: SemanticKeyLocation[],
  newLocations: SemanticKeyLocation[],
  priorData: DataSnapshot,
  ctx: ReconciliationContext,
  resolved: NodeResolutionAccumulator
): void {
  const intents = planTopToCollectionMoves(priorLocations, newLocations);
  const migratedCollections = new Set<string>();

  for (const intent of intents) {
    const source = intent.source;
    const target = intent.target;
    const sourceValue = priorData.values[source.nodeId];
    if (!sourceValue) {
      continue;
    }

    const outerCollection = ctx.newById.get(target.outerCollectionId);
    if (!outerCollection || outerCollection.type !== 'collection') {
      continue;
    }

    const updated = updateCollectionTargetValue(
      resolved.values[target.outerCollectionId],
      outerCollection,
      target.pathChain,
      sourceValue
    );

    resolved.values[target.outerCollectionId] = updated;
    delete resolved.values[source.nodeId];

    if (!migratedCollections.has(target.outerCollectionId)) {
      migratedCollections.add(target.outerCollectionId);
      resolved.diffs.push(
        migratedDiff(target.outerCollectionId, undefined, updated)
      );
    }
  }
}
