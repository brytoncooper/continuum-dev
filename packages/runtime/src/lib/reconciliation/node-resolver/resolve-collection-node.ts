import type { DataSnapshot, ViewNode } from '@continuum-dev/contract';
import type {
  NodeResolutionAccumulator,
  ReconciliationOptions,
} from '../../types.js';
import { carriedResolution, migratedDiff, migratedResolution } from '../differ/index.js';
import { reconcileCollectionValue } from '../collection-resolver/index.js';
import { carryValuesMeta } from '../result-builder/index.js';
import type { ConcreteMatchStrategy } from './shared.js';

export function resolveCollectionNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  priorNode: Extract<ViewNode, { type: 'collection' }>,
  priorNodeId: string,
  newNode: Extract<ViewNode, { type: 'collection' }>,
  matchedBy: ConcreteMatchStrategy,
  priorValue: unknown,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): void {
  const result = reconcileCollectionValue(
    priorNode,
    newNode,
    priorValue,
    options
  );

  acc.values[newId] = result.value;
  carryValuesMeta(
    acc.valueLineage,
    newId,
    priorNodeId,
    priorData,
    now,
    result.didMigrateItems
  );
  acc.issues.push(...result.issues);

  if (result.didMigrateItems) {
    acc.diffs.push(migratedDiff(newId, priorValue, result.value));
    acc.resolutions.push(
      migratedResolution(
        newId,
        priorNodeId,
        matchedBy,
        priorNode.type,
        newNode.type,
        priorValue,
        result.value
      )
    );
    return;
  }

  acc.resolutions.push(
    carriedResolution(
      newId,
      priorNodeId,
      matchedBy,
      priorNode.type,
      priorValue,
      result.value
    )
  );
}
