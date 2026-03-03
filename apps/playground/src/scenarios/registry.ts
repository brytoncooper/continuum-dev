import { actionLifecycleScenario } from './action-lifecycle';
import { collectionShowcaseScenario } from './collection-showcase';
import { deepNestingScenario } from './deep-nesting';
import { keyMatchingScenario } from './key-matching';
import { migrationStrategyScenario } from './migration-strategy';
import { orphanRetentionScenario } from './orphan-retention';
import { scaleStressScenario } from './scale-stress';
import { viewEvolutionScenario } from './view-evolution';
import type { Scenario } from './types';

export const scenarios: Scenario[] = [
  viewEvolutionScenario,
  deepNestingScenario,
  scaleStressScenario,
  collectionShowcaseScenario,
  migrationStrategyScenario,
  orphanRetentionScenario,
  keyMatchingScenario,
  actionLifecycleScenario,
];

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}

