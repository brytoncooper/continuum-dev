import type { DataSnapshot } from '@continuum-dev/contract';
import type { ReconciliationOptions } from '../types.js';

export function resolveReconciliationTimestamp(
  priorData: DataSnapshot | null,
  options: ReconciliationOptions
): number {
  if (options.clock) {
    return options.clock();
  }

  if (priorData) {
    return priorData.lineage.timestamp + 1;
  }

  throw new Error('reconcile requires options.clock when no prior data exists');
}
