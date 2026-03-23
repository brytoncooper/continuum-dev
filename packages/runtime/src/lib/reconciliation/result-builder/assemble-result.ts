import type { DataSnapshot, DetachedValue } from '@continuum-dev/contract';
import type {
  NodeResolutionAccumulator,
  ReconciliationResult,
} from '../../types.js';
import { computeViewHash } from './view-hash.js';
import { buildLineageFromPrior } from './reconciled-lineage.js';
import type {
  AssembleReconciliationResultInput,
  RemovedNodesResult,
} from './types.js';

export function assembleReconciliationResult(
  input: AssembleReconciliationResultInput
): ReconciliationResult {
  const { resolved, removals, priorData, newView, now } = input;
  const detachedValues = mergeDetachedValues(priorData, resolved, removals);
  const viewHash = computeViewHash(newView);

  return {
    reconciledState: {
      values: resolved.values,
      lineage: buildLineageFromPrior({
        priorLineage: priorData.lineage,
        now,
        newView,
        viewHash,
      }),
      ...(Object.keys(resolved.valueLineage).length > 0
        ? { valueLineage: resolved.valueLineage }
        : {}),
      ...(Object.keys(detachedValues).length > 0 ? { detachedValues } : {}),
    },
    diffs: [...resolved.diffs, ...removals.diffs],
    issues: [...resolved.issues, ...removals.issues],
    resolutions: resolved.resolutions,
  };
}

function mergeDetachedValues(
  priorData: DataSnapshot,
  resolved: NodeResolutionAccumulator,
  removals: RemovedNodesResult
): Record<string, DetachedValue> {
  const detachedValues: Record<string, DetachedValue> = {
    ...(priorData.detachedValues ?? {}),
    ...(resolved.detachedValues ?? {}),
    ...(removals.detachedValues ?? {}),
  };

  for (const restoredKey of resolved.restoredDetachedKeys ?? []) {
    delete detachedValues[restoredKey];
  }

  return detachedValues;
}
