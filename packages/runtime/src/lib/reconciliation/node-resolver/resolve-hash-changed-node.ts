import type { DataSnapshot, NodeValue, ViewNode } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import type {
  NodeResolutionAccumulator,
  ReconciliationOptions,
} from '../../types.js';
import { migratedDiff, migratedResolution } from '../differ/index.js';
import { attemptMigration } from '../migrator/index.js';
import { carryValuesMeta } from '../result-builder/index.js';
import { resolveUnchangedNode } from './resolve-unchanged-node.js';
import type { ConcreteMatchStrategy } from './shared.js';

export function resolveHashChangedNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  priorNode: ViewNode,
  priorNodeId: string,
  newNode: ViewNode,
  matchedBy: ConcreteMatchStrategy,
  priorValue: unknown,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): void {
  const migrationResult = attemptMigration(
    newId,
    priorNode,
    newNode,
    priorValue,
    options
  );

  if (migrationResult.kind === 'migrated') {
    acc.values[newId] = migrationResult.value as NodeValue;
    carryValuesMeta(acc.valueLineage, newId, priorNodeId, priorData, now, true);
    acc.diffs.push(migratedDiff(newId, priorValue, migrationResult.value));
    acc.resolutions.push(
      migratedResolution(
        newId,
        priorNodeId,
        matchedBy,
        priorNode.type,
        newNode.type,
        priorValue,
        migrationResult.value
      )
    );
    return;
  }

  acc.issues.push({
    severity: ISSUE_SEVERITY.WARNING,
    nodeId: newId,
    message:
      migrationResult.kind === 'error'
        ? `Node ${newId} migration failed: ${String(migrationResult.error)}`
        : `Node ${newId} view changed but no migration strategy available`,
    code: ISSUE_CODES.MIGRATION_FAILED,
  });

  resolveUnchangedNode(
    acc,
    newId,
    priorNode,
    priorNodeId,
    newNode,
    matchedBy,
    priorValue,
    priorData,
    now
  );
}
