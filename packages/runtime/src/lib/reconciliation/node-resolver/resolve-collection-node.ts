import {
  carriedResolution,
  migratedDiff,
  migratedResolution,
} from '../differ/index.js';
import { reconcileCollectionValue } from '../collection-resolver/index.js';
import { carryValuesMeta } from '../lineage-utils.js';
import type { ResolveCollectionNodeInput } from './types.js';

export function resolveCollectionNode(input: ResolveCollectionNodeInput): void {
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
  const result = reconcileCollectionValue({
    priorNode,
    newNode,
    priorValue,
    options,
  });

  acc.values[newId] = result.value;
  carryValuesMeta({
    target: acc.valueLineage,
    newId,
    priorId: priorNodeId,
    priorData,
    now,
    isMigrated: result.didMigrateItems,
  });
  acc.issues.push(...result.issues);

  if (result.didMigrateItems) {
    acc.diffs.push(migratedDiff(newId, priorValue, result.value));
    acc.resolutions.push(
      migratedResolution({
        nodeId: newId,
        priorId: priorNodeId,
        matchedBy,
        priorType: priorNode.type,
        newType: newNode.type,
        priorValue,
        reconciledValue: result.value,
      })
    );
    return;
  }

  acc.resolutions.push(
    carriedResolution({
      nodeId: newId,
      priorId: priorNodeId,
      matchedBy,
      nodeType: priorNode.type,
      priorValue,
      reconciledValue: result.value,
    })
  );
}
