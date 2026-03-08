import type { ViewNode } from '@continuum-dev/contract';
import type { ReconciliationOptions } from '../types.js';

export type MigrationAttemptResult =
  | { kind: 'migrated'; value: unknown }
  | { kind: 'none' }
  | { kind: 'error'; error: unknown };

interface RuleEdge {
  fromHash: string;
  toHash: string;
  strategyId: string;
}

const MAX_CHAIN_DEPTH = 10;

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

  if (newNode.migrations && priorNode.hash && newNode.hash) {
    if (!options.strategyRegistry) {
      return { kind: 'none' };
    }

    const directRule = newNode.migrations.find(
      (m) =>
        m.fromHash === priorNode.hash &&
        m.toHash === newNode.hash &&
        !!m.strategyId &&
        !!options.strategyRegistry?.[m.strategyId]
    );
    if (directRule?.strategyId) {
      try {
        return {
          kind: 'migrated',
          value: options.strategyRegistry[directRule.strategyId](
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

    const path = findMigrationPath(
      newNode.migrations,
      priorNode.hash,
      newNode.hash,
      options.strategyRegistry
    );

    if (!path) {
      return { kind: 'none' };
    }

    try {
      let currentValue: unknown = priorValue;
      let currentHash = priorNode.hash;
      for (const step of path) {
        const strategy = options.strategyRegistry[step.strategyId];
        const stepPriorNode = { ...priorNode, hash: currentHash };
        const stepNewNode = { ...newNode, hash: step.toHash };
        currentValue = strategy(
          nodeId,
          stepPriorNode,
          stepNewNode,
          currentValue
        );
        currentHash = step.toHash;
      }
      return { kind: 'migrated', value: currentValue };
    } catch (error) {
      return { kind: 'error', error };
    }
  }

  if (priorNode.type === newNode.type) {
    return { kind: 'migrated', value: priorValue };
  }
  return { kind: 'none' };
}

function findMigrationPath(
  rules: Array<{ fromHash: string; toHash: string; strategyId?: string }>,
  fromHash: string,
  toHash: string,
  strategyRegistry: Record<
    string,
    (
      nodeId: string,
      priorNode: ViewNode,
      newNode: ViewNode,
      priorValue: unknown
    ) => unknown
  >
): RuleEdge[] | null {
  const edges: RuleEdge[] = rules
    .filter((rule) => !!rule.strategyId && !!strategyRegistry[rule.strategyId!])
    .map((rule) => ({
      fromHash: rule.fromHash,
      toHash: rule.toHash,
      strategyId: rule.strategyId!,
    }));

  const byFrom = new Map<string, RuleEdge[]>();
  for (const edge of edges) {
    const existing = byFrom.get(edge.fromHash) ?? [];
    existing.push(edge);
    byFrom.set(edge.fromHash, existing);
  }

  const queue: Array<{ hash: string; path: RuleEdge[] }> = [
    { hash: fromHash, path: [] },
  ];
  const seen = new Set<string>([fromHash]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextEdges = byFrom.get(current.hash) ?? [];
    for (const edge of nextEdges) {
      const nextPath = [...current.path, edge];
      if (nextPath.length > MAX_CHAIN_DEPTH) {
        continue;
      }
      if (edge.toHash === toHash) {
        return nextPath;
      }
      if (!seen.has(edge.toHash)) {
        seen.add(edge.toHash);
        queue.push({ hash: edge.toHash, path: nextPath });
      }
    }
  }

  return null;
}
