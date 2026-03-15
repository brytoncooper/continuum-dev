import type { DataSnapshot } from '@continuum-dev/contract';
import type { FreshLineageInput, LineageWithHashInput } from './types.js';

export function buildLineageFromPrior(
  input: LineageWithHashInput
): DataSnapshot['lineage'] {
  return {
    ...input.priorLineage,
    timestamp: input.now,
    viewId: input.newView.viewId,
    viewVersion: input.newView.version,
    ...(input.viewHash !== undefined ? { viewHash: input.viewHash } : {}),
  };
}

export function buildFreshLineage(
  input: FreshLineageInput
): DataSnapshot['lineage'] {
  return {
    timestamp: input.now,
    sessionId: input.sessionId,
    viewId: input.newView.viewId,
    viewVersion: input.newView.version,
  };
}
