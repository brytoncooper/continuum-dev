import { VIEW_DIFFS } from '@continuum-dev/contract';
import type { StateDiff } from '../../types.js';

export function addedDiff(nodeId: string): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.ADDED,
    newValue: undefined,
    reason: 'Node added to view',
  };
}

export function removedDiff(nodeId: string, oldValue: unknown): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.REMOVED,
    oldValue,
    reason: 'Node removed from view',
  };
}

export function typeChangedDiff(
  nodeId: string,
  oldValue: unknown,
  priorType: string,
  newType: string
): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.TYPE_CHANGED,
    oldValue,
    reason: `Type changed from ${priorType} to ${newType}`,
  };
}

export function migratedDiff(
  nodeId: string,
  oldValue: unknown,
  newValue: unknown
): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.MIGRATED,
    oldValue,
    newValue,
    reason: 'Node view changed, migration applied',
  };
}

export function restoredDiff(nodeId: string, newValue: unknown): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.RESTORED,
    newValue,
    reason: 'Node restored from detached values',
  };
}
