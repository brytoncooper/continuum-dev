import type {
  SemanticKeyLocation,
  StructuralLevel,
} from './semantic-key-locations.js';

export function filterLocationsByLevel(
  locations: SemanticKeyLocation[],
  level: StructuralLevel
): SemanticKeyLocation[] {
  return locations.filter((location) => location.level === level);
}

export function findUniqueSameTypeLocation(
  locations: SemanticKeyLocation[],
  source: SemanticKeyLocation
): SemanticKeyLocation | null {
  const matches = locations.filter(
    (location) =>
      location.token === source.token && location.node.type === source.node.type
  );

  if (matches.length !== 1) {
    return null;
  }

  return matches[0];
}
