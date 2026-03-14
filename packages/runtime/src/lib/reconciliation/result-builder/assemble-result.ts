import type {
  DataSnapshot,
  DetachedValue,
  ViewDefinition,
} from '@continuum-dev/contract';
import type {
  NodeResolutionAccumulator,
  ReconciliationIssue,
  ReconciliationResult,
  StateDiff,
} from '../../types.js';
import { computeViewHash } from './view-hash.js';

type RemovalAccumulator = {
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  detachedValues?: Record<string, DetachedValue>;
};

export function assembleReconciliationResult(
  resolved: NodeResolutionAccumulator,
  removals: RemovalAccumulator,
  priorData: DataSnapshot,
  newView: ViewDefinition,
  now: number
): ReconciliationResult {
  const detachedValues = mergeDetachedValues(priorData, resolved, removals);
  const viewHash = computeViewHash(newView);

  return {
    reconciledState: {
      values: resolved.values,
      lineage: {
        ...priorData.lineage,
        timestamp: now,
        viewId: newView.viewId,
        viewVersion: newView.version,
        ...(viewHash !== undefined ? { viewHash } : {}),
      },
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
  removals: RemovalAccumulator
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
