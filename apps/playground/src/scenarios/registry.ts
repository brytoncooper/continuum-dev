import { actionLifecycleScenario } from './action-lifecycle';
import { keyMatchingScenario } from './key-matching';
import { migrationStrategyScenario } from './migration-strategy';
import { schemaEvolutionScenario } from './schema-evolution';
import type { Scenario } from './types';

export const scenarios: Scenario[] = [
  schemaEvolutionScenario,
  migrationStrategyScenario,
  keyMatchingScenario,
  actionLifecycleScenario,
];

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}

