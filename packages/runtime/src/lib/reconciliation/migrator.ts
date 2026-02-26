import type { ComponentDefinition } from '@continuum/contract';
import type { ReconciliationOptions } from '../types.js';

export type MigrationAttemptResult =
  | { kind: 'migrated'; value: unknown }
  | { kind: 'none' }
  | { kind: 'error'; error: unknown };

export function attemptMigration(
  componentId: string,
  priorDefinition: ComponentDefinition,
  newDefinition: ComponentDefinition,
  priorValue: unknown,
  options: ReconciliationOptions
): MigrationAttemptResult {
  if (options.migrationStrategies?.[componentId]) {
    try {
      return {
        kind: 'migrated',
        value: options.migrationStrategies[componentId](
          componentId,
          priorDefinition,
          newDefinition,
          priorValue
        ),
      };
    } catch (error) {
      return { kind: 'error', error };
    }
  }

  if (newDefinition.migrations && priorDefinition.hash && newDefinition.hash && options.strategyRegistry) {
    const rule = newDefinition.migrations.find(
      (m) => m.fromHash === priorDefinition.hash && m.toHash === newDefinition.hash
    );
    if (rule?.strategyId && options.strategyRegistry[rule.strategyId]) {
      try {
        return {
          kind: 'migrated',
          value: options.strategyRegistry[rule.strategyId](
            componentId,
            priorDefinition,
            newDefinition,
            priorValue
          ),
        };
      } catch (error) {
        return { kind: 'error', error };
      }
    }
  }

  if (priorDefinition.type === newDefinition.type) {
    return { kind: 'migrated', value: priorValue };
  }
  return { kind: 'none' };
}
