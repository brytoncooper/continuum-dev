import type { ConcreteMatchStrategy, MatchStrategy } from './types.js';

export function toConcreteMatchStrategy(
  matchedBy: MatchStrategy
): ConcreteMatchStrategy {
  return matchedBy ?? 'id';
}
