import type { SemanticKeyLocation } from './semantic-key-locations.js';
import {
  filterLocationsByLevel,
  findUniqueSameTypeLocation,
} from './semantic-key-matchers.js';

type CollectionLocation = SemanticKeyLocation & {
  level: 'collection';
  outerCollectionId: string;
  pathChain: string[];
};

export interface TopToCollectionMoveIntent {
  source: SemanticKeyLocation;
  target: CollectionLocation;
}

export interface CollectionToTopMoveIntent {
  source: CollectionLocation;
  target: SemanticKeyLocation;
}

export function planTopToCollectionMoves(
  priorLocations: SemanticKeyLocation[],
  newLocations: SemanticKeyLocation[]
): TopToCollectionMoveIntent[] {
  const priorTop = filterLocationsByLevel(priorLocations, 'top');
  const newTop = filterLocationsByLevel(newLocations, 'top');
  const newCollection = filterLocationsByLevel(newLocations, 'collection');
  const intents: TopToCollectionMoveIntent[] = [];

  for (const source of priorTop) {
    if (findUniqueSameTypeLocation(newTop, source)) {
      continue;
    }

    const target = findUniqueSameTypeLocation(newCollection, source);
    if (!target || !target.outerCollectionId || !target.pathChain?.length) {
      continue;
    }

    intents.push({
      source,
      target: target as CollectionLocation,
    });
  }

  return intents;
}

export function planCollectionToTopMoves(
  priorLocations: SemanticKeyLocation[],
  newLocations: SemanticKeyLocation[]
): CollectionToTopMoveIntent[] {
  const priorCollection = filterLocationsByLevel(priorLocations, 'collection');
  const newCollection = filterLocationsByLevel(newLocations, 'collection');
  const newTop = filterLocationsByLevel(newLocations, 'top');
  const intents: CollectionToTopMoveIntent[] = [];

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

    intents.push({
      source: source as CollectionLocation,
      target,
    });
  }

  return intents;
}
