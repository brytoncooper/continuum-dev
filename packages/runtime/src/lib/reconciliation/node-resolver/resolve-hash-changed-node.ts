import type { NodeValue } from '@continuum-dev/contract';
import { migratedDiff, migratedResolution } from '../differ/index.js';
import { createMigrationFailureIssue } from '../migration-failure-issue.js';
import { attemptMigration } from '../migrator/index.js';
import { carryValuesMeta } from '../lineage-utils.js';
import { resolveUnchangedNode } from './resolve-unchanged-node.js';
import type { ResolveHashChangedNodeInput } from './types.js';

export function resolveHashChangedNode(input: ResolveHashChangedNodeInput): void {
  const {
    acc,
    newId,
    priorNode,
    priorNodeId,
    newNode,
    matchedBy,
    priorValue,
    priorData,
    now,
    options,
  } = input;
  const migrationResult = attemptMigration({
    nodeId: newId,
    priorNode,
    newNode,
    priorValue,
    options,
  });

  if (migrationResult.kind === 'migrated') {
    acc.values[newId] = migrationResult.value as NodeValue;
    carryValuesMeta({
      target: acc.valueLineage,
      newId,
      priorId: priorNodeId,
      priorData,
      now,
      isMigrated: true,
    });
    acc.diffs.push(migratedDiff(newId, priorValue, migrationResult.value));
    acc.resolutions.push(
      migratedResolution({
        nodeId: newId,
        priorId: priorNodeId,
        matchedBy,
        priorType: priorNode.type,
        newType: newNode.type,
        priorValue,
        reconciledValue: migrationResult.value,
      })
    );
    return;
  }

  acc.issues.push(createMigrationFailureIssue(newId, migrationResult));

  resolveUnchangedNode({
    acc,
    newId,
    priorNode,
    priorNodeId,
    newNode,
    matchedBy,
    priorValue,
    priorData,
    now,
  });
}
