import type { DataSnapshot } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../context/index.js';
import type { NodeResolutionAccumulator } from '../types.js';
import { migratedDiff } from '../reconciliation/differ/index.js';
import type { SemanticKeyLocation } from './semantic-key-locations.js';
import { cloneNodeValue, readCollectionFirstItemValue } from './semantic-key-collection-paths.js';
import {
  filterLocationsByLevel,
  findUniqueSameTypeLocation,
} from './semantic-key-matchers.js';

export function applyCollectionToTopMoves(
  priorLocations: SemanticKeyLocation[],
  newLocations: SemanticKeyLocation[],
  priorData: DataSnapshot,
  ctx: ReconciliationContext,
  resolved: NodeResolutionAccumulator
): void {
  const priorCollection = filterLocationsByLevel(priorLocations, 'collection');
  const newCollection = filterLocationsByLevel(newLocations, 'collection');
  const newTop = filterLocationsByLevel(newLocations, 'top');
  const migratedNodes = new Set<string>();

  for (const source of priorCollection) {
    if (
      !source.outerCollectionId ||
      !source.pathChain?.length ||
      findUniqueSameTypeLocation(newCollection, source)
    ) {
      continue;
    }

    const target = findUniqueSameTypeLocation(newTop, source);
    if (!target) {
      continue;
    }

    const priorCollectionNode = ctx.priorById.get(source.outerCollectionId);
    if (!priorCollectionNode || priorCollectionNode.type !== 'collection') {
      continue;
    }

    const extracted = readCollectionFirstItemValue(
      priorData,
      source.outerCollectionId,
      priorCollectionNode,
      source.pathChain
    );
    if (!extracted) {
      continue;
    }

    resolved.values[target.nodeId] = cloneNodeValue(extracted);
    if (!migratedNodes.has(target.nodeId)) {
      migratedNodes.add(target.nodeId);
      resolved.diffs.push(
        migratedDiff(target.nodeId, undefined, resolved.values[target.nodeId])
      );
    }
  }
}
