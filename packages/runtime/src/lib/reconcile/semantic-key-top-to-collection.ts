import type { DataSnapshot } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../context/index.js';
import type { NodeResolutionAccumulator } from '../types.js';
import { migratedDiff } from '../reconciliation/differ/index.js';
import type { SemanticKeyLocation } from './semantic-key-locations.js';
import {
  filterLocationsByLevel,
  findUniqueSameTypeLocation,
} from './semantic-key-matchers.js';
import { updateCollectionTargetValue } from './semantic-key-collection-paths.js';

export function applyTopToCollectionMoves(
  priorLocations: SemanticKeyLocation[],
  newLocations: SemanticKeyLocation[],
  priorData: DataSnapshot,
  ctx: ReconciliationContext,
  resolved: NodeResolutionAccumulator
): void {
  const priorTop = filterLocationsByLevel(priorLocations, 'top');
  const newTop = filterLocationsByLevel(newLocations, 'top');
  const newCollection = filterLocationsByLevel(newLocations, 'collection');
  const migratedCollections = new Set<string>();

  for (const source of priorTop) {
    if (findUniqueSameTypeLocation(newTop, source)) {
      continue;
    }

    const target = findUniqueSameTypeLocation(newCollection, source);
    if (!target || !target.outerCollectionId || !target.pathChain?.length) {
      continue;
    }

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
