import type { ComponentDefinition } from '@continuum/contract';
import type { ReconciliationOptions } from '../types.js';

export function attemptMigration(
  componentId: string,
  priorDefinition: ComponentDefinition,
  newDefinition: ComponentDefinition,
  priorValue: unknown,
  options: ReconciliationOptions
): unknown | null {
  if (options.migrationStrategies?.[componentId]) {
    return options.migrationStrategies[componentId](
      componentId,
      priorDefinition,
      newDefinition,
      priorValue
    );
  }

  if (newDefinition.migrations && priorDefinition.hash && newDefinition.hash && options.strategyRegistry) {
    const rule = newDefinition.migrations.find(
      (m) => m.fromHash === priorDefinition.hash && m.toHash === newDefinition.hash
    );
    if (rule?.strategyId && options.strategyRegistry[rule.strategyId]) {
      return options.strategyRegistry[rule.strategyId](
        componentId,
        priorDefinition,
        newDefinition,
        priorValue
      );
    }
  }

  if (priorDefinition.type === newDefinition.type) {
    return priorValue;
  }
  return null;
}
