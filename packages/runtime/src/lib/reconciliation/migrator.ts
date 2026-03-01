import type { ViewNode } from '@continuum/contract';
import type { ReconciliationOptions } from '../types.js';

export type MigrationAttemptResult =
  | { kind: 'migrated'; value: unknown }
  | { kind: 'none' }
  | { kind: 'error'; error: unknown };

export function attemptMigration(
  nodeId: string,
  priorNode: ViewNode,
  newNode: ViewNode,
  priorValue: unknown,
  options: ReconciliationOptions
): MigrationAttemptResult {
  if (options.migrationStrategies?.[nodeId]) {
    try {
      return {
        kind: 'migrated',
        value: options.migrationStrategies[nodeId](
          nodeId,
          priorNode,
          newNode,
          priorValue
        ),
      };
    } catch (error) {
      return { kind: 'error', error };
    }
  }

  if (newNode.migrations && priorNode.hash && newNode.hash && options.strategyRegistry) {
    const rule = newNode.migrations.find(
      (m) => m.fromHash === priorNode.hash && m.toHash === newNode.hash
    );
    if (rule?.strategyId && options.strategyRegistry[rule.strategyId]) {
      try {
        return {
          kind: 'migrated',
          value: options.strategyRegistry[rule.strategyId](
            nodeId,
            priorNode,
            newNode,
            priorValue
          ),
        };
      } catch (error) {
        return { kind: 'error', error };
      }
    }
  }

  if (priorNode.type === newNode.type) {
    return { kind: 'migrated', value: priorValue };
  }
  return { kind: 'none' };
}
