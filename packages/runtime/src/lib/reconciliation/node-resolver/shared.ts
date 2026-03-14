import type { ReconciliationResolution } from '../../types.js';

export type MatchStrategy = ReconciliationResolution['matchedBy'];
export type ConcreteMatchStrategy = Exclude<MatchStrategy, null>;

export function toConcreteMatchStrategy(
  matchedBy: MatchStrategy
): ConcreteMatchStrategy {
  return matchedBy ?? 'id';
}
