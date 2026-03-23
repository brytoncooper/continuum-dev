import type { NodeValue, DataSnapshot } from '@continuum-dev/contract';
import type { ReconciliationIssue as SessionIssue } from '@continuum-dev/runtime';
import type { SessionState } from '../state/index.js';
import { cloneCheckpointSnapshot } from '../state/index.js';
import { buildCommittedSnapshotFromCurrentState } from '../listeners/index.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toAcceptedNodeValue(value: unknown): NodeValue {
  if (isRecord(value) && 'value' in value) {
    const nextValue = structuredClone(value) as Record<string, unknown>;
    delete nextValue.suggestion;
    (nextValue as any).isDirty = true;
    return nextValue as unknown as NodeValue;
  }
  return {
    value,
    isDirty: true,
  } as NodeValue;
}

export function removeDetachedValue(
  data: SessionState['currentData'],
  detachedKey: string
): DataSnapshot | null {
  if (!data || !data.detachedValues || !(detachedKey in data.detachedValues)) {
    return data;
  }
  const detachedValues = data.detachedValues;
  const nextDetachedValues = { ...detachedValues };
  delete nextDetachedValues[detachedKey];
  return {
    ...data,
    detachedValues:
      Object.keys(nextDetachedValues).length === 0
        ? undefined
        : nextDetachedValues,
    values: data.values || {},
  } as DataSnapshot;
}

export function replaceIssuesForNode(
  issues: SessionIssue[],
  nodeId: string,
  nextIssues: SessionIssue[]
): SessionIssue[] {
  return [...issues.filter((issue) => issue.nodeId !== nodeId), ...nextIssues];
}

export function refreshLastAutoCheckpoint(internal: SessionState): void {
  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.trigger === 'auto');
  if (!lastAutoCheckpoint) {
    return;
  }
  const snapshot = buildCommittedSnapshotFromCurrentState(internal);
  if (snapshot) {
    lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
  }
}
